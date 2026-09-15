import app.services.jazzcash_service as jazzcash_service
from tests.conftest import auth_headers, onboard_and_login_admin


def _configure_jazzcash(monkeypatch, merchant_id="MC12345", password="t3stpassw0rd", salt="t3st1ntegr1tysalt"):
    monkeypatch.setattr(jazzcash_service.settings, "JAZZCASH_MERCHANT_ID", merchant_id)
    monkeypatch.setattr(jazzcash_service.settings, "JAZZCASH_PASSWORD", password)
    monkeypatch.setattr(jazzcash_service.settings, "JAZZCASH_INTEGRITY_SALT", salt)
    # is_configured() also gates on ENVIRONMENT != "testing" so a real .env credential can never
    # leak into a live network call from the test suite — bypass just that guard here since
    # these tests never actually reach the internet (there's no JazzCash server to call: the
    # "callback" is simulated locally with a correctly/incorrectly signed payload).
    monkeypatch.setattr(jazzcash_service.JazzCashService, "is_configured", lambda self: True)


def create_class(client, headers, name="Grade 5", level_order=5, academic_year="2026-2027"):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": academic_year},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_student(client, headers, class_id, email="sam@greenwood.example.com"):
    response = client.post(
        "/api/v1/students",
        json={"full_name": "Sam Student", "email": email, "password": "Password123!", "class_grade_id": class_id},
        headers=headers,
    )
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


def generate_invoice(client, headers, class_id, period_month=9, period_year=2026, due_date="2026-09-10"):
    response = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_id, "period_month": period_month, "period_year": period_year, "due_date": due_date},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()[0]


def link_parent(client, headers, student_id, email="parent@greenwood.example.com"):
    response = client.post(
        f"/api/v1/students/{student_id}/parents",
        json={"full_name": "Pat Parent", "email": email, "password": "Password123!"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def _setup_invoice(client, headers, amount=4000):
    class_grade = create_class(client, headers)
    create_fee_plan(client, headers, class_grade["id"], monthly_amount=amount)
    student = create_student(client, headers, class_grade["id"])
    invoice = generate_invoice(client, headers, class_grade["id"])
    return class_grade, student, invoice


def _sign(fields: dict) -> str:
    return jazzcash_service.JazzCashService()._generate_secure_hash(fields)


def test_initiate_jazzcash_payment_not_configured_is_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, _student, invoice = _setup_invoice(client, headers)

    response = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=headers)
    assert response.status_code == 409


def test_admin_initiates_jazzcash_payment(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, _student, invoice = _setup_invoice(client, headers, amount=4000)

    response = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=headers)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["checkout_url"]
    assert body["txn_ref_no"]
    fields = body["fields"]
    assert fields["pp_TxnRefNo"] == body["txn_ref_no"]
    assert fields["pp_Amount"] == "400000"  # PKR 4000 in paisas
    assert fields["pp_MerchantID"] == "MC12345"
    assert fields["pp_SecureHash"]
    # the hash we generated must itself be reproducible/valid
    assert _sign(fields) == fields["pp_SecureHash"]


def test_parent_initiates_payment_for_own_child(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, student, invoice = _setup_invoice(client, headers)
    link_parent(client, headers, student["id"])
    parent_headers = _login(client, "parent@greenwood.example.com")

    response = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=parent_headers)
    assert response.status_code == 201, response.text


def test_parent_cannot_initiate_payment_for_someone_elses_invoice(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, _student, invoice = _setup_invoice(client, headers)
    link_parent(client, headers, invoice["student_id"], email="realparent@greenwood.example.com")

    other_student = create_student(client, headers, _class["id"], email="other@greenwood.example.com")
    link_parent(client, headers, other_student["id"], email="otherparent@greenwood.example.com")
    other_parent_headers = _login(client, "otherparent@greenwood.example.com")

    response = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=other_parent_headers)
    assert response.status_code == 403


def test_teacher_cannot_initiate_jazzcash_payment(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, _student, invoice = _setup_invoice(client, headers)
    teacher = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    ).json()
    teacher_headers = _login(client, teacher["email"])

    response = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=teacher_headers)
    assert response.status_code == 403


def test_jazzcash_callback_success_marks_invoice_paid(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, student, invoice = _setup_invoice(client, headers, amount=4000)
    link_parent(client, headers, student["id"])

    init = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=headers).json()
    fields = dict(init["fields"])
    fields["pp_ResponseCode"] = "000"
    fields["pp_ResponseMessage"] = "Transaction Successful"
    fields["pp_RetreivalReferenceNo"] = "RRN123456789"
    fields["pp_SecureHash"] = _sign(fields)

    callback = client.post("/api/v1/fees/gateway/jazzcash/callback", data=fields, follow_redirects=False)
    assert callback.status_code == 303
    assert "jazzcash=success" in callback.headers["location"]

    invoice_after = client.get(f"/api/v1/fees/invoices/{invoice['id']}", headers=headers).json()
    assert invoice_after["status"] == "paid"

    payments = client.get("/api/v1/fees/payments", headers=headers).json()
    assert len(payments) == 1
    assert payments[0]["verification_status"] == "verified"
    assert payments[0]["payment_method"] == "jazzcash"
    assert payments[0]["amount"] == 4000

    txns = client.get(f"/api/v1/fees/invoices/{invoice['id']}/gateway-transactions", headers=headers).json()
    assert len(txns) == 1
    assert txns[0]["status"] == "completed"
    assert txns[0]["gateway_txn_id"] == "RRN123456789"
    assert txns[0]["payment_id"] == payments[0]["id"]


def test_jazzcash_callback_rejects_tampered_hash(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, student, invoice = _setup_invoice(client, headers)
    link_parent(client, headers, student["id"])

    init = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=headers).json()
    fields = dict(init["fields"])
    fields["pp_ResponseCode"] = "000"
    fields["pp_SecureHash"] = "0" * 64  # deliberately wrong

    callback = client.post("/api/v1/fees/gateway/jazzcash/callback", data=fields, follow_redirects=False)
    assert callback.status_code == 303
    assert "jazzcash=failed" in callback.headers["location"]

    invoice_after = client.get(f"/api/v1/fees/invoices/{invoice['id']}", headers=headers).json()
    assert invoice_after["status"] == "pending"
    assert client.get("/api/v1/fees/payments", headers=headers).json() == []

    txns = client.get(f"/api/v1/fees/invoices/{invoice['id']}/gateway-transactions", headers=headers).json()
    assert txns[0]["status"] == "failed"
    assert "hash" in txns[0]["gateway_response_message"].lower()


def test_jazzcash_callback_handles_declined_transaction(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, student, invoice = _setup_invoice(client, headers)
    link_parent(client, headers, student["id"])

    init = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=headers).json()
    fields = dict(init["fields"])
    fields["pp_ResponseCode"] = "121"  # a real, validly-signed decline — not a hash problem
    fields["pp_ResponseMessage"] = "Insufficient balance"
    fields["pp_SecureHash"] = _sign(fields)

    callback = client.post("/api/v1/fees/gateway/jazzcash/callback", data=fields, follow_redirects=False)
    assert "jazzcash=failed" in callback.headers["location"]

    invoice_after = client.get(f"/api/v1/fees/invoices/{invoice['id']}", headers=headers).json()
    assert invoice_after["status"] == "pending"

    txns = client.get(f"/api/v1/fees/invoices/{invoice['id']}/gateway-transactions", headers=headers).json()
    assert txns[0]["status"] == "failed"
    assert txns[0]["gateway_response_code"] == "121"


def test_jazzcash_callback_unknown_transaction_reference(client):
    response = client.post(
        "/api/v1/fees/gateway/jazzcash/callback",
        data={"pp_TxnRefNo": "TDOESNOTEXIST", "pp_ResponseCode": "000", "pp_SecureHash": "abc"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert "jazzcash=error" in response.headers["location"]


def test_jazzcash_callback_is_idempotent_against_duplicates(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, student, invoice = _setup_invoice(client, headers)
    link_parent(client, headers, student["id"])

    init = client.post(f"/api/v1/fees/invoices/{invoice['id']}/pay/jazzcash", headers=headers).json()
    fields = dict(init["fields"])
    fields["pp_ResponseCode"] = "000"
    fields["pp_RetreivalReferenceNo"] = "RRN1"
    fields["pp_SecureHash"] = _sign(fields)

    client.post("/api/v1/fees/gateway/jazzcash/callback", data=fields, follow_redirects=False)
    client.post("/api/v1/fees/gateway/jazzcash/callback", data=fields, follow_redirects=False)  # retried by JazzCash

    payments = client.get("/api/v1/fees/payments", headers=headers).json()
    assert len(payments) == 1  # not duplicated


def test_non_admin_cannot_view_gateway_transactions_of_others(client, monkeypatch):
    _configure_jazzcash(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _class, _student, invoice = _setup_invoice(client, headers)
    teacher = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    ).json()
    teacher_headers = _login(client, teacher["email"])

    response = client.get(f"/api/v1/fees/invoices/{invoice['id']}/gateway-transactions", headers=teacher_headers)
    assert response.status_code == 403
