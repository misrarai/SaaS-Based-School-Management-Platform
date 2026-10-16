import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select

from app.models.fee import Invoice, InvoiceStatus, InvoiceType, Payment, PaymentMethod, PaymentVerificationStatus
from app.models.payout import PayoutStatus, TeacherPayout
from app.models.user import User
from tests.conftest import auth_headers, onboard_and_login_admin

BASE = "/api/v1/accounting"


def _setup(client, slug="greenwood"):
    headers = auth_headers(onboard_and_login_admin(client, slug=slug))
    resp = client.post(f"{BASE}/accounts/seed-defaults", headers=headers)
    assert resp.status_code == 200, resp.text
    accounts = {a["code"]: a for a in client.get(f"{BASE}/accounts", headers=headers).json()}
    return headers, accounts


def _voucher(client, headers, lines, vtype="JV", vdate="2026-03-10", post=True, expected=201):
    resp = client.post(
        f"{BASE}/vouchers",
        json={"voucher_type": vtype, "voucher_date": vdate, "narration": "test", "lines": lines, "post": post},
        headers=headers,
    )
    assert resp.status_code == expected, resp.text
    return resp.json()


def test_seed_default_chart_is_idempotent(client):
    headers, accounts = _setup(client)
    assert accounts["1110"]["name"] == "Cash in Hand"
    assert accounts["1110"]["subtype"] == "cash"
    assert accounts["5100"]["account_type"] == "expense"
    assert accounts["1110"]["parent_id"] == accounts["1100"]["id"]
    again = client.post(f"{BASE}/accounts/seed-defaults", headers=headers).json()
    assert again["created"] == 0


def test_create_account_with_parent_and_duplicate_code(client):
    headers, accounts = _setup(client)
    resp = client.post(
        f"{BASE}/accounts",
        json={"code": "5310", "name": "Electricity", "account_type": "expense", "parent_id": accounts["5300"]["id"]},
        headers=headers,
    )
    assert resp.status_code == 201
    dup = client.post(f"{BASE}/accounts", json={"code": "5310", "name": "X", "account_type": "expense"}, headers=headers)
    assert dup.status_code == 409
    wrong_parent = client.post(
        f"{BASE}/accounts",
        json={"code": "5320", "name": "Gas", "account_type": "expense", "parent_id": accounts["1000"]["id"]},
        headers=headers,
    )
    assert wrong_parent.status_code == 422


def test_voucher_numbering_balance_and_immutability(client):
    headers, acc = _setup(client)
    lines = [
        {"account_id": acc["1110"]["id"], "debit": 5000},
        {"account_id": acc["3100"]["id"], "credit": 5000},
    ]
    v1 = _voucher(client, headers, lines, vtype="CRV", post=False)
    v2 = _voucher(client, headers, lines, vtype="CRV", post=False)
    v3 = _voucher(client, headers, lines, vtype="JV", post=False)
    assert (v1["voucher_number"], v2["voucher_number"], v3["voucher_number"]) == ("CRV-0001", "CRV-0002", "JV-0001")
    assert v1["status"] == "draft"

    unbalanced = [
        {"account_id": acc["1110"]["id"], "debit": 5000},
        {"account_id": acc["3100"]["id"], "credit": 4000},
    ]
    _voucher(client, headers, unbalanced, expected=422)
    both_sides = [
        {"account_id": acc["1110"]["id"], "debit": 10, "credit": 10},
        {"account_id": acc["3100"]["id"], "credit": 0},
    ]
    _voucher(client, headers, both_sides, expected=422)

    # draft is editable
    edit = client.patch(f"{BASE}/vouchers/{v1['id']}", json={"narration": "edited"}, headers=headers)
    assert edit.status_code == 200 and edit.json()["narration"] == "edited"

    posted = client.post(f"{BASE}/vouchers/{v1['id']}/post", headers=headers)
    assert posted.status_code == 200 and posted.json()["status"] == "posted"
    assert client.patch(f"{BASE}/vouchers/{v1['id']}", json={"narration": "x"}, headers=headers).status_code == 409
    assert client.delete(f"{BASE}/vouchers/{v1['id']}", headers=headers).status_code == 409
    assert client.post(f"{BASE}/vouchers/{v1['id']}/post", headers=headers).status_code == 409

    # drafts can be deleted
    assert client.delete(f"{BASE}/vouchers/{v2['id']}", headers=headers).status_code == 204


def test_reverse_voucher_creates_posted_jv(client):
    headers, acc = _setup(client)
    v = _voucher(client, headers, [
        {"account_id": acc["5200"]["id"], "debit": 30000},
        {"account_id": acc["1120"]["id"], "credit": 30000},
    ], vtype="BPV")
    resp = client.post(f"{BASE}/vouchers/{v['id']}/reverse", json={"reversal_date": "2026-03-15"}, headers=headers)
    assert resp.status_code == 201, resp.text
    rev = resp.json()
    assert rev["voucher_type"] == "JV" and rev["status"] == "posted"
    assert rev["reversal_of_id"] == v["id"]
    rent_line = next(l for l in rev["lines"] if l["account_id"] == acc["5200"]["id"])
    assert rent_line["credit"] == 30000
    # cannot reverse twice
    assert client.post(f"{BASE}/vouchers/{v['id']}/reverse", headers=headers).status_code == 409
    ledger = client.get(f"{BASE}/reports/ledger", params={"account_id": acc["5200"]["id"]}, headers=headers).json()
    assert ledger["closing_balance"] == 0


def test_quick_expense_and_income_entries(client):
    headers, acc = _setup(client)
    exp = client.post(f"{BASE}/quick-entries", json={
        "entry_type": "expense", "head_account_id": acc["5300"]["id"], "cash_bank_account_id": acc["1110"]["id"],
        "amount": 2500, "entry_date": "2026-04-02", "payee": "WAPDA", "description": "Electricity bill",
        "attachment_url": "https://files.example.com/bill.png",
    }, headers=headers)
    assert exp.status_code == 201, exp.text
    assert exp.json()["voucher_type"] == "CPV" and exp.json()["status"] == "posted"

    inc = client.post(f"{BASE}/quick-entries", json={
        "entry_type": "income", "head_account_id": acc["4900"]["id"], "cash_bank_account_id": acc["1120"]["id"],
        "amount": 10000, "entry_date": "2026-04-03", "description": "Hall rental",
    }, headers=headers)
    assert inc.status_code == 201
    assert inc.json()["voucher_type"] == "BRV"

    bad = client.post(f"{BASE}/quick-entries", json={
        "entry_type": "expense", "head_account_id": acc["5300"]["id"], "cash_bank_account_id": acc["5200"]["id"],
        "amount": 1, "entry_date": "2026-04-02",
    }, headers=headers)
    assert bad.status_code == 422
    assert len(client.get(f"{BASE}/quick-entries", headers=headers).json()) == 2


def test_reports_trial_balance_pl_balance_sheet_ledger(client):
    headers, acc = _setup(client)
    _voucher(client, headers, [  # capital
        {"account_id": acc["1120"]["id"], "debit": 100000},
        {"account_id": acc["3100"]["id"], "credit": 100000},
    ], vtype="BRV", vdate="2026-01-05")
    _voucher(client, headers, [  # fee income
        {"account_id": acc["1110"]["id"], "debit": 40000},
        {"account_id": acc["4100"]["id"], "credit": 40000},
    ], vtype="CRV", vdate="2026-02-10")
    _voucher(client, headers, [  # salary
        {"account_id": acc["5100"]["id"], "debit": 25000},
        {"account_id": acc["1110"]["id"], "credit": 25000},
    ], vtype="CPV", vdate="2026-02-28")
    _voucher(client, headers, [  # draft should not count
        {"account_id": acc["5100"]["id"], "debit": 999},
        {"account_id": acc["1110"]["id"], "credit": 999},
    ], vtype="CPV", vdate="2026-02-28", post=False)

    tb = client.get(f"{BASE}/reports/trial-balance", headers=headers).json()
    assert tb["is_balanced"] and tb["total_debit"] == 140000

    pl = client.get(f"{BASE}/reports/income-statement",
                    params={"date_from": "2026-02-01", "date_to": "2026-02-28"}, headers=headers).json()
    assert pl["total_income"] == 40000 and pl["total_expenses"] == 25000 and pl["net_profit"] == 15000

    bs = client.get(f"{BASE}/reports/balance-sheet", params={"as_of": "2026-12-31"}, headers=headers).json()
    assert bs["total_assets"] == 115000
    assert bs["total_liabilities_and_equity"] == 115000 and bs["is_balanced"]

    ledger = client.get(f"{BASE}/reports/ledger", params={
        "account_id": acc["1110"]["id"], "date_from": "2026-02-15", "date_to": "2026-12-31"}, headers=headers).json()
    assert ledger["opening_balance"] == 40000
    assert ledger["entries"][0]["balance"] == 15000 and ledger["closing_balance"] == 15000

    cash_book = client.get(f"{BASE}/reports/cash-book", headers=headers).json()
    assert cash_book["account_code"] == "1110" and cash_book["closing_balance"] == 15000

    day_book = client.get(f"{BASE}/reports/day-book",
                          params={"date_from": "2026-02-01", "date_to": "2026-02-28"}, headers=headers).json()
    assert len(day_book["vouchers"]) == 2

    monthly = client.get(f"{BASE}/reports/monthly", params={"year": 2026}, headers=headers).json()
    feb = monthly[1]
    assert feb["income"] == 40000 and feb["expense"] == 25000 and feb["net"] == 15000

    accounts = {a["code"]: a for a in client.get(f"{BASE}/accounts", headers=headers).json()}
    assert accounts["1110"]["balance"] == 15000


def test_closed_period_rejects_posting(client):
    headers, acc = _setup(client)
    lines = [{"account_id": acc["1110"]["id"], "debit": 100}, {"account_id": acc["4900"]["id"], "credit": 100}]
    draft = _voucher(client, headers, lines, vdate="2026-05-10", post=False)
    resp = client.post(f"{BASE}/periods/close", json={"year": 2026, "month": 5}, headers=headers)
    assert resp.status_code == 200 and resp.json()["status"] == "closed"

    periods = client.get(f"{BASE}/periods", params={"year": 2026}, headers=headers).json()
    assert periods[4]["status"] == "closed" and periods[5]["status"] == "open"

    _voucher(client, headers, lines, vdate="2026-05-11", post=True, expected=422)
    assert client.post(f"{BASE}/vouchers/{draft['id']}/post", headers=headers).status_code == 422

    client.post(f"{BASE}/periods/reopen", json={"year": 2026, "month": 5}, headers=headers)
    assert client.post(f"{BASE}/vouchers/{draft['id']}/post", headers=headers).status_code == 200


def test_sync_fee_payments_and_payouts_is_idempotent(client, db_session):
    headers = auth_headers(onboard_and_login_admin(client))
    admin = db_session.execute(select(User).where(User.email == "admin@greenwood.example.com")).scalar_one()
    tenant_id = admin.tenant_id

    invoice = Invoice(
        tenant_id=tenant_id, student_id=uuid.uuid4(), class_grade_id=uuid.uuid4(), invoice_type=InvoiceType.TUITION,
        invoice_number="INV-1", period_month=3, period_year=2026, amount_due=4000, discount_amount=0,
        net_amount=4000, due_date=date(2026, 3, 10), status=InvoiceStatus.PAID,
    )
    db_session.add(invoice)
    db_session.flush()
    now = datetime(2026, 3, 5, tzinfo=timezone.utc)
    for method, vstatus in [
        (PaymentMethod.CASH, PaymentVerificationStatus.VERIFIED),
        (PaymentMethod.JAZZCASH, PaymentVerificationStatus.VERIFIED),
        (PaymentMethod.CASH, PaymentVerificationStatus.PENDING),
    ]:
        db_session.add(Payment(
            tenant_id=tenant_id, invoice_id=invoice.id, amount=2000, payment_method=method,
            submitted_by_user_id=admin.id, submitted_at=now, verification_status=vstatus, verified_at=now,
        ))
    db_session.add(TeacherPayout(
        tenant_id=tenant_id, teacher_id=uuid.uuid4(), period_month=3, period_year=2026, sessions_delivered=4,
        calculated_amount=1500, status=PayoutStatus.PAID, paid_at=now,
    ))
    db_session.add(TeacherPayout(
        tenant_id=tenant_id, teacher_id=uuid.uuid4(), period_month=3, period_year=2026, sessions_delivered=4,
        calculated_amount=900, status=PayoutStatus.APPROVED,
    ))
    db_session.commit()

    status = client.get(f"{BASE}/sync/status", headers=headers).json()
    assert status == {"pending_fee_payments": 2, "pending_payouts": 1}

    result = client.post(f"{BASE}/sync", headers=headers).json()
    assert result["fee_vouchers_created"] == 2 and result["payout_vouchers_created"] == 1

    again = client.post(f"{BASE}/sync", headers=headers).json()
    assert again["fee_vouchers_created"] == 0 and again["payout_vouchers_created"] == 0

    vouchers = client.get(f"{BASE}/vouchers", params={"source": "sync"}, headers=headers).json()
    assert sorted(v["voucher_type"] for v in vouchers) == ["BPV", "BRV", "CRV"]
    pl = client.get(f"{BASE}/reports/income-statement", headers=headers).json()
    assert pl["total_income"] == 4000 and pl["total_expenses"] == 1500


def test_voucher_pdf(client):
    headers, acc = _setup(client)
    v = _voucher(client, headers, [
        {"account_id": acc["1110"]["id"], "debit": 50, "description": "cash"},
        {"account_id": acc["4900"]["id"], "credit": 50},
    ], vtype="CRV")
    resp = client.get(f"{BASE}/vouchers/{v['id']}/pdf", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


def test_tenant_isolation_and_admin_only(client):
    headers_a, acc_a = _setup(client, slug="greenwood")
    v = _voucher(client, headers_a, [
        {"account_id": acc_a["1110"]["id"], "debit": 50},
        {"account_id": acc_a["4900"]["id"], "credit": 50},
    ])
    headers_b, acc_b = _setup(client, slug="riverside")
    assert client.get(f"{BASE}/vouchers/{v['id']}", headers=headers_b).status_code == 404
    assert client.get(f"{BASE}/vouchers", headers=headers_b).json() == []
    # tenant B cannot use tenant A accounts in its vouchers
    _voucher(client, headers_b, [
        {"account_id": acc_a["1110"]["id"], "debit": 50},
        {"account_id": acc_b["4900"]["id"], "credit": 50},
    ], expected=422)
    assert client.get(f"{BASE}/accounts").status_code == 401
