from tests.conftest import auth_headers, onboard_and_login_admin


def create_class(client, headers, name="Grade 5", level_order=5, academic_year="2026-2027"):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": academic_year},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_student(client, headers, class_id, email="sam@greenwood.example.com", discount=None):
    payload = {
        "full_name": "Sam Student",
        "email": email,
        "password": "Password123!",
        "class_grade_id": class_id,
    }
    if discount is not None:
        payload["admission_detail"] = {"discount_amount": discount}
    response = client.post("/api/v1/students", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def create_fee_plan(client, headers, class_id, academic_year="2026-2027", monthly_amount=4000):
    response = client.post(
        "/api/v1/fees/plans",
        json={"class_grade_id": class_id, "academic_year": academic_year, "monthly_amount": monthly_amount},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def test_admin_creates_fee_plan(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    plan = create_fee_plan(client, headers, class_grade["id"])
    assert plan["monthly_amount"] == 4000

    listing = client.get("/api/v1/fees/plans", headers=headers)
    assert len(listing.json()) == 1


def test_duplicate_fee_plan_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"])

    response = client.post(
        "/api/v1/fees/plans",
        json={"class_grade_id": class_grade["id"], "academic_year": "2026-2027", "monthly_amount": 5000},
        headers=headers,
    )
    assert response.status_code == 409


def test_bulk_generate_invoices_applies_discount_and_is_idempotent(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)
    student = create_student(client, headers, class_grade["id"], discount=500)

    body = {"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"}
    first = client.post("/api/v1/fees/invoices/generate", json=body, headers=headers)
    assert first.status_code == 201, first.text
    invoices = first.json()
    assert len(invoices) == 1
    invoice = invoices[0]
    assert invoice["student_id"] == student["id"]
    assert invoice["amount_due"] == 4000
    assert invoice["discount_amount"] == 500
    assert invoice["net_amount"] == 3500
    assert invoice["status"] == "pending"
    assert invoice["invoice_number"]

    second = client.post("/api/v1/fees/invoices/generate", json=body, headers=headers)
    assert second.status_code == 201
    assert second.json() == []  # idempotent — already generated for this period

    listing = client.get("/api/v1/fees/invoices", headers=headers)
    assert len(listing.json()) == 1


def test_generate_invoices_requires_fee_plan(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_student(client, headers, class_grade["id"])

    response = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    assert response.status_code == 404


def test_admin_creates_single_admission_invoice(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])

    response = client.post(
        "/api/v1/fees/invoices",
        json={
            "student_id": student["id"],
            "invoice_type": "admission",
            "amount_due": 10000,
            "due_date": "2026-09-01",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["invoice_type"] == "admission"
    assert response.json()["net_amount"] == 10000


def test_parent_submits_payment_and_admin_verifies(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)
    student = create_student(client, headers, class_grade["id"])

    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    invoice = generated.json()[0]

    link_resp = client.post(
        f"/api/v1/students/{student['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert link_resp.status_code == 201
    parent_headers = _login(client, "parent@greenwood.example.com")

    submit = client.post(
        f"/api/v1/fees/invoices/{invoice['id']}/payments",
        params={"amount": 4000, "payment_method": "jazzcash", "reference_note": "TXN123"},
        headers=parent_headers,
    )
    assert submit.status_code == 201, submit.text
    payment = submit.json()
    assert payment["verification_status"] == "pending"

    pending = client.get("/api/v1/fees/payments/pending", headers=headers)
    assert len(pending.json()) == 1

    verify = client.post(
        f"/api/v1/fees/payments/{payment['id']}/verify", json={"approve": True}, headers=headers
    )
    assert verify.status_code == 200
    assert verify.json()["verification_status"] == "verified"

    invoice_after = client.get(f"/api/v1/fees/invoices/{invoice['id']}", headers=headers)
    assert invoice_after.json()["status"] == "paid"


def test_pending_and_all_payments_show_student_name(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)
    student = create_student(client, headers, class_grade["id"])
    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    invoice = generated.json()[0]
    client.post(
        f"/api/v1/students/{student['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    parent_headers = _login(client, "parent@greenwood.example.com")
    submit = client.post(
        f"/api/v1/fees/invoices/{invoice['id']}/payments",
        params={"amount": 4000, "payment_method": "jazzcash"},
        headers=parent_headers,
    )
    payment_id = submit.json()["id"]

    pending = client.get("/api/v1/fees/payments/pending", headers=headers)
    assert pending.status_code == 200
    assert pending.json()[0]["student_name"] == "Sam Student"
    assert pending.json()[0]["invoice_number"] == invoice["invoice_number"]

    all_pending = client.get("/api/v1/fees/payments?status=pending", headers=headers)
    assert len(all_pending.json()) == 1

    client.post(f"/api/v1/fees/payments/{payment_id}/verify", json={"approve": True}, headers=headers)

    all_payments = client.get("/api/v1/fees/payments", headers=headers)
    assert len(all_payments.json()) == 1
    assert all_payments.json()[0]["verification_status"] == "verified"
    assert all_payments.json()[0]["student_name"] == "Sam Student"

    still_pending = client.get("/api/v1/fees/payments?status=pending", headers=headers)
    assert still_pending.json() == []


def test_subscriptions_show_plan_and_current_invoice_status(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4500)
    create_student(client, headers, class_grade["id"], email="sam@greenwood.example.com")

    before_invoice = client.get("/api/v1/fees/subscriptions", headers=headers)
    assert before_invoice.status_code == 200
    entry = before_invoice.json()[0]
    assert entry["student_name"] == "Sam Student"
    assert entry["class_grade_name"] == class_grade["name"]
    assert entry["monthly_amount"] == 4500
    assert entry["current_status"] is None

    client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    after_invoice = client.get("/api/v1/fees/subscriptions", headers=headers)
    assert after_invoice.json()[0]["current_status"] == "pending"


def test_report_summary_totals_collected_and_outstanding(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)
    student_a = create_student(client, headers, class_grade["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], email="b@greenwood.example.com")

    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    ).json()
    invoice_a = next(inv for inv in generated if inv["student_id"] == student_a["id"])

    client.post(
        f"/api/v1/students/{student_a['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent_a@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    parent_a_headers = _login(client, "parent_a@greenwood.example.com")
    submit = client.post(
        f"/api/v1/fees/invoices/{invoice_a['id']}/payments",
        params={"amount": 4000, "payment_method": "easypaisa"},
        headers=parent_a_headers,
    )
    client.post(f"/api/v1/fees/payments/{submit.json()['id']}/verify", json={"approve": True}, headers=headers)

    report = client.get("/api/v1/fees/reports/summary?period_month=9&period_year=2026", headers=headers)
    assert report.status_code == 200
    body = report.json()
    assert body["total_collected"] == 4000
    assert body["total_pending"] == 4000  # student_b's invoice, still unpaid
    assert body["by_method"] == {"easypaisa": 4000}
    assert student_b  # sanity


def test_teacher_cannot_access_finance_admin_endpoints(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    teacher_resp = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert teacher_resp.status_code == 201
    teacher_headers = _login(client, "tom@greenwood.example.com")

    assert client.get("/api/v1/fees/payments", headers=teacher_headers).status_code == 403
    assert client.get("/api/v1/fees/subscriptions", headers=teacher_headers).status_code == 403
    assert client.get("/api/v1/fees/reports/summary", headers=teacher_headers).status_code == 403


def test_parent_cannot_pay_for_someone_elses_invoice(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)
    student_a = create_student(client, headers, class_grade["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], email="b@greenwood.example.com")

    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    invoice_a = next(inv for inv in generated.json() if inv["student_id"] == student_a["id"])

    client.post(
        f"/api/v1/students/{student_a['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent_a@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    client.post(
        f"/api/v1/students/{student_b['id']}/parents",
        json={"full_name": "Nosy Parent", "email": "parent_b@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    parent_b_headers = _login(client, "parent_b@greenwood.example.com")

    # parent_b is linked only to student_b — must not be able to pay student_a's invoice.
    response = client.post(
        f"/api/v1/fees/invoices/{invoice_a['id']}/payments",
        params={"amount": 4000, "payment_method": "cash"},
        headers=parent_b_headers,
    )
    assert response.status_code == 403

    # parent_a IS linked to student_a — payment must succeed.
    parent_a_headers = _login(client, "parent_a@greenwood.example.com")
    ok_response = client.post(
        f"/api/v1/fees/invoices/{invoice_a['id']}/payments",
        params={"amount": 4000, "payment_method": "cash"},
        headers=parent_a_headers,
    )
    assert ok_response.status_code == 201


def test_student_and_parent_scoped_invoice_listing(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)
    student_a = create_student(client, headers, class_grade["id"], email="a@greenwood.example.com")
    create_student(client, headers, class_grade["id"], email="b@greenwood.example.com")

    client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )

    student_a_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "a@greenwood.example.com", "password": "Password123!"},
    )
    student_a_headers = auth_headers(student_a_login.json())
    response = client.get("/api/v1/fees/invoices", headers=student_a_headers)
    assert response.status_code == 200
    invoices = response.json()
    assert len(invoices) == 1
    assert invoices[0]["student_id"] == student_a["id"]


def test_invoices_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    class_grade = create_class(client, headers_a)
    create_fee_plan(client, headers_a, class_grade["id"])
    create_student(client, headers_a, class_grade["id"])
    client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers_a,
    )

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/fees/invoices", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []


def test_referral_discount_field_on_admission_detail(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)

    referring_family = client.post(
        "/api/v1/families",
        json={"family_name": "Referrer Family", "cnic": "1234567890123", "phone": "03001234567"},
        headers=headers,
    ).json()

    student_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Referred Student",
            "email": "referred@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "admission_detail": {
                "referred_by_family_id": referring_family["id"],
                "referral_discount_amount": 500,
                "referral_note": "Referred by Referrer Family",
            },
        },
        headers=headers,
    )
    assert student_resp.status_code == 201, student_resp.text
    student = student_resp.json()

    invoice_resp = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    invoices = [inv for inv in invoice_resp.json() if inv["student_id"] == student["id"]]
    assert len(invoices) == 1
    assert invoices[0]["discount_amount"] == 500
    assert invoices[0]["net_amount"] == 3500


def test_verify_payment_rejection(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)
    create_student(client, headers, class_grade["id"])

    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    invoice = generated.json()[0]

    submit = client.post(
        f"/api/v1/fees/invoices/{invoice['id']}/payments",
        params={"amount": 4000, "payment_method": "bank_transfer"},
        headers=headers,
    )
    payment = submit.json()

    reject = client.post(
        f"/api/v1/fees/payments/{payment['id']}/verify",
        json={"approve": False, "rejection_reason": "Receipt unreadable"},
        headers=headers,
    )
    assert reject.status_code == 200
    assert reject.json()["verification_status"] == "rejected"
    assert reject.json()["rejection_reason"] == "Receipt unreadable"

    invoice_after = client.get(f"/api/v1/fees/invoices/{invoice['id']}", headers=headers)
    assert invoice_after.json()["status"] == "pending"


def test_bulk_generate_invoices_across_all_classes_with_plans(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_a = create_class(client, headers, name="Grade 5", level_order=5)
    class_b = create_class(client, headers, name="Grade 6", level_order=6)
    create_fee_plan(client, headers, class_a["id"], monthly_amount=4000)
    create_fee_plan(client, headers, class_b["id"], monthly_amount=5000)
    create_student(client, headers, class_a["id"], email="a@greenwood.example.com")
    create_student(client, headers, class_b["id"], email="b@greenwood.example.com")

    # No class_grade_ids given -> every class with a fee plan.
    response = client.post(
        "/api/v1/fees/invoices/bulk-generate",
        json={"period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["invoices_created"] == 2
    assert body["classes_processed"] == 2
    assert body["skipped"] == []

    listing = client.get("/api/v1/fees/invoices", headers=headers)
    assert len(listing.json()) == 2


def test_bulk_generate_skips_classes_without_a_fee_plan(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_with_plan = create_class(client, headers, name="Grade 5", level_order=5)
    class_without_plan = create_class(client, headers, name="Grade 6", level_order=6)
    create_fee_plan(client, headers, class_with_plan["id"], monthly_amount=4000)
    create_student(client, headers, class_with_plan["id"], email="a@greenwood.example.com")
    create_student(client, headers, class_without_plan["id"], email="b@greenwood.example.com")

    response = client.post(
        "/api/v1/fees/invoices/bulk-generate",
        json={
            "class_grade_ids": [class_with_plan["id"], class_without_plan["id"]],
            "period_month": 9,
            "period_year": 2026,
            "due_date": "2026-09-10",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["invoices_created"] == 1
    assert body["classes_processed"] == 1
    assert len(body["skipped"]) == 1
    assert "no fee plan" in body["skipped"][0]


def test_mark_overdue_invoices_flips_past_due_pending_invoices(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)
    create_student(client, headers, class_grade["id"])

    client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 1, "period_year": 2020, "due_date": "2020-01-10"},
        headers=headers,
    )

    response = client.post("/api/v1/fees/invoices/mark-overdue", headers=headers)
    assert response.status_code == 200
    assert response.json()["marked_overdue"] == 1

    listing = client.get("/api/v1/fees/invoices?status=overdue", headers=headers)
    assert len(listing.json()) == 1

    # Idempotent — nothing left to flip on a second run.
    second = client.post("/api/v1/fees/invoices/mark-overdue", headers=headers)
    assert second.json()["marked_overdue"] == 0


def test_referral_credit_applied_to_referring_family_on_new_admission(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=4000)

    # Referring family's own child, admitted first with no referral involved.
    referrer = create_student(client, headers, class_grade["id"], email="referrer@greenwood.example.com")

    # Give the referrer a family explicitly.
    family_resp = client.post("/api/v1/families", json={"family_name": "Khan Family"}, headers=headers)
    family_id = family_resp.json()["id"]
    client.patch(f"/api/v1/students/{referrer['id']}", json={"family_id": family_id}, headers=headers)

    # A new student is admitted, referred by that family.
    new_student_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Referred Student",
            "email": "referred@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "admission_detail": {"referred_by_family_id": family_id},
        },
        headers=headers,
    )
    assert new_student_resp.status_code == 201, new_student_resp.text

    # The referring family's own child (referrer) should now carry the reward as a discount.
    referrer_after = client.get(f"/api/v1/students/{referrer['id']}", headers=headers).json()
    assert referrer_after["admission_detail"]["referral_discount_amount"] == 500.0

    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 9, "period_year": 2026, "due_date": "2026-09-10"},
        headers=headers,
    )
    referrer_invoice = next(inv for inv in generated.json() if inv["student_id"] == referrer["id"])
    assert referrer_invoice["discount_amount"] == 500.0
    assert referrer_invoice["net_amount"] == 3500.0
