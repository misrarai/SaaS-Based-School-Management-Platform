from datetime import date, timedelta

from tests.conftest import auth_headers, onboard_and_login_admin
from tests.test_fees import _login, create_class, create_fee_plan, create_student

BASE = "/api/v1/fee-collection"


def _family(client, headers, name="Khan Family"):
    resp = client.post(
        "/api/v1/families", json={"family_name": name, "cnic": "1234567890123", "phone": "03001234567"}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _student(client, headers, class_id, email, name="Sam Student", family_id=None):
    payload = {"full_name": name, "email": email, "password": "Password123!", "class_grade_id": class_id}
    if family_id:
        payload["family_id"] = family_id
    resp = client.post("/api/v1/students", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _heads(client, headers):
    resp = client.post(f"{BASE}/heads/seed-defaults", headers=headers)
    assert resp.status_code == 200, resp.text
    return {h["name"]: h for h in resp.json()}


def _setup_structure(client, headers, class_id):
    heads = _heads(client, headers)
    resp = client.put(
        f"{BASE}/structure/{class_id}",
        json={
            "items": [
                {"fee_head_id": heads["Tuition Fee"]["id"], "amount": 4000, "frequency": "monthly"},
                {"fee_head_id": heads["Transport Fee"]["id"], "amount": 1000, "frequency": "monthly"},
                {"fee_head_id": heads["Exam Fee"]["id"], "amount": 500, "frequency": "per_term"},
            ]
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["monthly_total"] == 5000
    return heads


def _generate(client, headers, class_id, month=9, due="2026-09-10", include=None):
    resp = client.post(
        f"{BASE}/invoices/generate",
        json={
            "class_grade_id": class_id,
            "period_month": month,
            "period_year": 2026,
            "due_date": due,
            "include_head_ids": include or [],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_fee_heads_crud_and_duplicate(client):
    headers = auth_headers(onboard_and_login_admin(client))
    heads = _heads(client, headers)
    assert "Tuition Fee" in heads and "Fine" in heads
    dup = client.post(f"{BASE}/heads", json={"name": "Tuition Fee"}, headers=headers)
    assert dup.status_code == 409
    created = client.post(f"{BASE}/heads", json={"name": "Sports Fee", "default_frequency": "annual"}, headers=headers)
    assert created.status_code == 201
    upd = client.patch(f"{BASE}/heads/{created.json()['id']}", json={"code": "SPT"}, headers=headers)
    assert upd.json()["code"] == "SPT"
    deleted = client.delete(f"{BASE}/heads/{created.json()['id']}", headers=headers)
    assert deleted.json()["result"] == "deleted"


def test_structured_generation_with_lines_and_concessions(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cg = create_class(client, headers)
    heads = _setup_structure(client, headers, cg["id"])
    student = _student(client, headers, cg["id"], "a@greenwood.example.com")

    # 50% off tuition + fixed 200 overall
    c1 = client.post(
        f"{BASE}/concessions",
        json={"student_id": student["id"], "fee_head_id": heads["Tuition Fee"]["id"], "concession_type": "percentage", "value": 50, "reason": "Sibling"},
        headers=headers,
    )
    assert c1.status_code == 201, c1.text
    client.post(
        f"{BASE}/concessions",
        json={"student_id": student["id"], "concession_type": "fixed", "value": 200, "reason": "Merit"},
        headers=headers,
    )
    bad = client.post(
        f"{BASE}/concessions",
        json={"student_id": student["id"], "concession_type": "percentage", "value": 150},
        headers=headers,
    )
    assert bad.status_code == 422

    result = _generate(client, headers, cg["id"], include=[heads["Exam Fee"]["id"]])
    assert result["invoices_created"] == 1
    inv = result["invoices"][0]
    assert inv["amount_due"] == 5500
    assert inv["discount_amount"] == 2200  # 2000 tuition + 200 overall
    assert inv["net_amount"] == 3300
    assert inv["balance"] == 3300

    lines = client.get(f"{BASE}/invoices/{inv['id']}/lines", headers=headers).json()
    assert len(lines) == 3
    assert {line["concession_amount"] for line in lines} == {2000, 0}

    again = _generate(client, headers, cg["id"])
    assert again["invoices_created"] == 0 and again["skipped_existing"] == 1

    pdf = client.get(f"{BASE}/invoices/{inv['id']}/voucher.pdf", headers=headers)
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")
    bulk = client.get(f"{BASE}/vouchers/bulk.pdf", params={"class_grade_id": cg["id"], "period_month": 9, "period_year": 2026}, headers=headers)
    assert bulk.status_code == 200 and bulk.content.startswith(b"%PDF")


def test_legacy_invoice_without_lines_still_works(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cg = create_class(client, headers)
    create_fee_plan(client, headers, cg["id"], monthly_amount=4000)
    create_student(client, headers, cg["id"])
    inv = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": cg["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    ).json()[0]
    assert client.get(f"{BASE}/invoices/{inv['id']}/lines", headers=headers).json() == []
    pdf = client.get(f"{BASE}/invoices/{inv['id']}/voucher.pdf", headers=headers)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_counter_family_collection_partial_oldest_first(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cg = create_class(client, headers)
    _setup_structure(client, headers, cg["id"])
    fam = _family(client, headers)
    s1 = _student(client, headers, cg["id"], "k1@greenwood.example.com", "Ali Khan", fam["id"])
    _student(client, headers, cg["id"], "k2@greenwood.example.com", "Sara Khan", fam["id"])
    _generate(client, headers, cg["id"], month=8, due="2026-08-10")
    _generate(client, headers, cg["id"], month=9, due="2026-09-10")

    search = client.get(f"{BASE}/counter/search", params={"q": fam["family_number"]}, headers=headers).json()
    assert search[0]["family_id"] == fam["id"]
    assert search[0]["outstanding"] == 20000
    by_name = client.get(f"{BASE}/counter/search", params={"q": "Ali Khan"}, headers=headers).json()
    assert by_name[0]["family_id"] == fam["id"]

    account = client.get(f"{BASE}/counter/account", params={"family_id": fam["id"]}, headers=headers).json()
    assert len(account["open_invoices"]) == 4
    assert account["open_invoices"][0]["period_month"] == 8

    too_much = client.post(f"{BASE}/counter/collect", json={"family_id": fam["id"], "amount": 99999}, headers=headers)
    assert too_much.status_code == 400

    resp = client.post(
        f"{BASE}/counter/collect",
        json={"family_id": fam["id"], "amount": 12000, "payment_method": "cash", "collected_on": date.today().isoformat()},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    receipt = resp.json()
    assert receipt["receipt_number"] == "R-000001"
    assert receipt["total_amount"] == 12000
    assert len(receipt["allocations"]) == 3
    statuses = sorted(a["invoice_status"] for a in receipt["allocations"])
    assert statuses.count("paid") == 2
    partial = next(a for a in receipt["allocations"] if a["invoice_status"] != "paid")
    assert partial["amount"] == 2000 and partial["invoice_balance_after"] == 3000

    account = client.get(f"{BASE}/counter/account", params={"family_id": fam["id"]}, headers=headers).json()
    assert account["total_outstanding"] == 8000
    assert len(account["open_invoices"]) == 2

    # payments are VERIFIED immediately and visible in the existing payments list
    payments = client.get("/api/v1/fees/payments", headers=headers).json()
    assert len(payments) == 3 and all(p["verification_status"] == "verified" for p in payments)

    pdf = client.get(f"{BASE}/receipts/{receipt['id']}/pdf", headers=headers)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")

    ledger = client.get(f"{BASE}/ledger", params={"family_id": fam["id"]}, headers=headers).json()
    assert ledger["total_billed"] == 20000
    assert ledger["total_paid"] == 12000
    assert ledger["closing_balance"] == 8000
    assert ledger["entries"][-1]["balance"] == 8000
    assert client.get(f"{BASE}/ledger/pdf", params={"family_id": fam["id"]}, headers=headers).content.startswith(b"%PDF")

    report = client.get(f"{BASE}/reports/daily-collection", headers=headers).json()
    assert report["total"] == 12000
    assert report["by_method"] == {"cash": 12000}
    assert report["by_collector"] == {"Alice Admin": 12000}
    summary = client.get(f"{BASE}/reports/class-summary", params={"period_month": 8, "period_year": 2026}, headers=headers).json()
    assert summary["total_billed"] == 10000 and summary["total_collected"] == 10000
    assert s1  # sanity


def test_late_fee_applied_at_collection_and_mark_overdue(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cg = create_class(client, headers)
    _setup_structure(client, headers, cg["id"])
    student = _student(client, headers, cg["id"], "late@greenwood.example.com")
    rule = client.put(f"{BASE}/late-fee-rule", json={"amount": 300, "grace_days": 0}, headers=headers)
    assert rule.status_code == 200 and rule.json()["amount"] == 300
    past_due = (date.today() - timedelta(days=40)).isoformat()
    _generate(client, headers, cg["id"], month=1, due=past_due)

    account = client.get(f"{BASE}/counter/account", params={"student_id": student["id"]}, headers=headers).json()
    assert account["pending_late_fee"] == 300

    marked = client.post("/api/v1/fees/invoices/mark-overdue", headers=headers)
    assert marked.json()["marked_overdue"] == 1
    inv = client.get(f"{BASE}/invoices", headers=headers).json()[0]
    assert inv["status"] == "overdue"
    assert inv["late_fee_amount"] == 300 and inv["net_amount"] == 5300
    # second run does not double-charge
    client.post("/api/v1/fees/invoices/mark-overdue", headers=headers)
    assert client.get(f"{BASE}/invoices", headers=headers).json()[0]["net_amount"] == 5300

    resp = client.post(f"{BASE}/counter/collect", json={"student_id": student["id"], "amount": 5300}, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["allocations"][0]["invoice_status"] == "paid"


def test_defaulters_filters_export_and_remind(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cg = create_class(client, headers)
    other = create_class(client, headers, name="Grade 6", level_order=6)
    _setup_structure(client, headers, cg["id"])
    _student(client, headers, cg["id"], "d1@greenwood.example.com", "Debtor One")
    _student(client, headers, other["id"], "d2@greenwood.example.com", "Other Class")
    old_due = (date.today() - timedelta(days=70)).isoformat()
    _generate(client, headers, cg["id"], month=1, due=old_due)
    _generate(client, headers, cg["id"], month=2, due=(date.today() + timedelta(days=5)).isoformat())

    rows = client.get(f"{BASE}/defaulters", headers=headers).json()
    assert len(rows) == 1
    assert rows[0]["student_name"] == "Debtor One"
    assert rows[0]["overdue_balance"] == 5000  # future-due invoice not counted
    assert rows[0]["months_overdue"] >= 2
    assert client.get(f"{BASE}/defaulters", params={"class_grade_id": other["id"]}, headers=headers).json() == []
    assert client.get(f"{BASE}/defaulters", params={"min_amount": 6000}, headers=headers).json() == []
    assert client.get(f"{BASE}/defaulters", params={"months_overdue": 12}, headers=headers).json() == []

    export = client.get(f"{BASE}/defaulters/export", headers=headers)
    assert export.status_code == 200
    assert export.content[:2] == b"PK"

    remind = client.post(f"{BASE}/defaulters/remind", json={}, headers=headers)
    assert remind.status_code == 200, remind.text
    assert remind.json()["students_reminded"] == 1


def test_parent_voucher_and_receipt_ownership(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cg = create_class(client, headers)
    _setup_structure(client, headers, cg["id"])
    a = _student(client, headers, cg["id"], "pa@greenwood.example.com", "Kid A")
    b = _student(client, headers, cg["id"], "pb@greenwood.example.com", "Kid B")
    invoices = _generate(client, headers, cg["id"])["invoices"]
    inv_a = next(i for i in invoices if i["student_id"] == a["id"])
    inv_b = next(i for i in invoices if i["student_id"] == b["id"])
    client.post(
        f"/api/v1/students/{a['id']}/parents",
        json={"full_name": "Parent A", "email": "parent_a@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    parent = _login(client, "parent_a@greenwood.example.com")

    assert client.get(f"{BASE}/invoices/{inv_a['id']}/voucher.pdf", headers=parent).status_code == 200
    assert client.get(f"{BASE}/invoices/{inv_b['id']}/voucher.pdf", headers=parent).status_code == 403
    mine = client.get(f"{BASE}/invoices", headers=parent).json()
    assert [i["id"] for i in mine] == [inv_a["id"]]

    r_a = client.post(f"{BASE}/counter/collect", json={"student_id": a["id"], "amount": 1000}, headers=headers).json()
    r_b = client.post(f"{BASE}/counter/collect", json={"student_id": b["id"], "amount": 1000}, headers=headers).json()
    assert client.get(f"{BASE}/receipts/{r_a['id']}/pdf", headers=parent).status_code == 200
    assert client.get(f"{BASE}/receipts/{r_b['id']}/pdf", headers=parent).status_code == 403
    my_receipts = client.get(f"{BASE}/my/receipts", headers=parent).json()
    assert [r["id"] for r in my_receipts] == [r_a["id"]]
    assert client.get(f"{BASE}/ledger", params={"student_id": b["id"]}, headers=parent).status_code == 403
    assert client.get(f"{BASE}/counter/search", params={"q": "Kid"}, headers=parent).status_code == 403


def test_tenant_isolation(client):
    headers_a = auth_headers(onboard_and_login_admin(client, slug="greenwood"))
    cg = create_class(client, headers_a)
    _setup_structure(client, headers_a, cg["id"])
    st = _student(client, headers_a, cg["id"], "iso@greenwood.example.com")
    inv = _generate(client, headers_a, cg["id"])["invoices"][0]

    headers_b = auth_headers(onboard_and_login_admin(client, slug="riverside"))
    assert client.get(f"{BASE}/heads", headers=headers_b).json() == []
    assert client.get(f"{BASE}/invoices/{inv['id']}/voucher.pdf", headers=headers_b).status_code == 404
    assert client.post(f"{BASE}/counter/collect", json={"student_id": st["id"], "amount": 10}, headers=headers_b).status_code == 404
    assert client.get(f"{BASE}/structure/{cg['id']}", headers=headers_b).status_code == 404


def test_verify_payment_only_pending_and_submit_validation(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cg = create_class(client, headers)
    create_fee_plan(client, headers, cg["id"], monthly_amount=4000)
    create_student(client, headers, cg["id"])
    inv = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": cg["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    ).json()[0]

    bad = client.post(f"/api/v1/fees/invoices/{inv['id']}/payments", params={"amount": 0, "payment_method": "cash"}, headers=headers)
    assert bad.status_code == 400
    neg = client.post(f"/api/v1/fees/invoices/{inv['id']}/payments", params={"amount": -5, "payment_method": "cash"}, headers=headers)
    assert neg.status_code == 400

    p1 = client.post(f"/api/v1/fees/invoices/{inv['id']}/payments", params={"amount": 1000, "payment_method": "cash"}, headers=headers).json()
    ok = client.post(f"/api/v1/fees/payments/{p1['id']}/verify", json={"approve": True}, headers=headers)
    assert ok.status_code == 200
    again = client.post(f"/api/v1/fees/payments/{p1['id']}/verify", json={"approve": False}, headers=headers)
    assert again.status_code == 409
    after = client.get(f"/api/v1/fees/invoices/{inv['id']}", headers=headers).json()
    assert after["status"] == "pending" and after["amount_paid"] == 1000

    p2 = client.post(f"/api/v1/fees/invoices/{inv['id']}/payments", params={"amount": 3000, "payment_method": "cash"}, headers=headers).json()
    client.post(f"/api/v1/fees/payments/{p2['id']}/verify", json={"approve": True}, headers=headers)
    assert client.get(f"/api/v1/fees/invoices/{inv['id']}", headers=headers).json()["status"] == "paid"

    paid = client.post(f"/api/v1/fees/invoices/{inv['id']}/payments", params={"amount": 100, "payment_method": "cash"}, headers=headers)
    assert paid.status_code == 409


def test_itemized_single_invoice_and_teacher_forbidden(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cg = create_class(client, headers)
    heads = _heads(client, headers)
    st = _student(client, headers, cg["id"], "item@greenwood.example.com")
    resp = client.post(
        f"{BASE}/invoices",
        json={
            "student_id": st["id"],
            "invoice_type": "admission",
            "due_date": "2026-09-01",
            "lines": [
                {"fee_head_id": heads["Admission Fee"]["id"], "amount": 10000},
                {"description": "Uniform", "amount": 2500},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["net_amount"] == 12500
    lines = client.get(f"{BASE}/invoices/{resp.json()['id']}/lines", headers=headers).json()
    assert {line["description"] for line in lines} == {"Admission Fee", "Uniform"}

    client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    teacher = _login(client, "tom@greenwood.example.com")
    assert client.get(f"{BASE}/heads", headers=teacher).status_code == 403
    assert client.get(f"{BASE}/defaulters", headers=teacher).status_code == 403
