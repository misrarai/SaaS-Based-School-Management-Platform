from datetime import date

from tests.conftest import auth_headers, onboard_and_login_admin

TODAY = date.today()


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_section(client, headers, class_id, name="A"):
    response = client.post(f"/api/v1/classes/{class_id}/sections", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_subject(client, headers, class_id, name="Mathematics", code="MATH5"):
    response = client.post(f"/api/v1/classes/{class_id}/subjects", json={"name": name, "code": code}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_teacher(client, headers, email="tom@greenwood.example.com"):
    response = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": email, "password": "Password123!"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_student(client, headers, class_id, section_id, email="sam@greenwood.example.com"):
    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": email,
            "password": "Password123!",
            "class_grade_id": class_id,
            "section_id": section_id,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def schedule_teacher(client, headers, section_id, subject_id, teacher_id):
    response = client.post(
        "/api/v1/schedule/templates",
        json={
            "section_id": section_id,
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "day_of_week": TODAY.weekday(),
            "start_time": "09:00:00",
            "end_time": "09:45:00",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def _setup(client, headers):
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    schedule_teacher(client, headers, section["id"], subject["id"], teacher["id"])
    return class_grade, section, subject, teacher


def test_per_session_payout(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": TODAY.isoformat(), "end_date": TODAY.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    client.post(f"/api/v1/schedule/sessions/{session_id}/start", headers=teacher_headers)
    client.post(f"/api/v1/schedule/sessions/{session_id}/end", headers=teacher_headers)

    rate = client.post(
        "/api/v1/payouts/rates",
        json={"teacher_id": teacher["id"], "rate_type": "per_session", "rate_value": 500, "effective_from": "2026-01-01"},
        headers=headers,
    )
    assert rate.status_code == 201, rate.text

    payout = client.post(
        "/api/v1/payouts/generate",
        json={"teacher_id": teacher["id"], "period_month": TODAY.month, "period_year": TODAY.year},
        headers=headers,
    )
    assert payout.status_code == 201, payout.text
    body = payout.json()
    assert body["sessions_delivered"] == 1
    assert body["calculated_amount"] == 500
    assert body["status"] == "draft"
    assert class_grade and section and subject  # sanity


def test_revenue_share_payout(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])

    client.post(
        "/api/v1/fees/plans",
        json={"class_grade_id": class_grade["id"], "academic_year": "2026-2027", "monthly_amount": 4000},
        headers=headers,
    )
    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": TODAY.month, "period_year": TODAY.year, "due_date": "2026-09-10"},
        headers=headers,
    )
    invoice = generated.json()[0]
    payment = client.post(
        f"/api/v1/fees/invoices/{invoice['id']}/payments",
        params={"amount": 4000, "payment_method": "cash"},
        headers=headers,
    ).json()
    client.post(f"/api/v1/fees/payments/{payment['id']}/verify", json={"approve": True}, headers=headers)

    client.post(
        "/api/v1/payouts/rates",
        json={"teacher_id": teacher["id"], "rate_type": "revenue_share_percent", "rate_value": 60, "effective_from": "2026-01-01"},
        headers=headers,
    )

    payout = client.post(
        "/api/v1/payouts/generate",
        json={"teacher_id": teacher["id"], "period_month": TODAY.month, "period_year": TODAY.year},
        headers=headers,
    )
    assert payout.status_code == 201, payout.text
    assert payout.json()["calculated_amount"] == 2400  # 60% of 4000
    assert student["id"]  # sanity


def test_payout_without_rate_returns_404(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, _, _, teacher = _setup(client, headers)

    response = client.post(
        "/api/v1/payouts/generate",
        json={"teacher_id": teacher["id"], "period_month": TODAY.month, "period_year": TODAY.year},
        headers=headers,
    )
    assert response.status_code == 404


def test_approve_then_paid_flow_and_regeneration_blocked(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, _, _, teacher = _setup(client, headers)
    client.post(
        "/api/v1/payouts/rates",
        json={"teacher_id": teacher["id"], "rate_type": "per_session", "rate_value": 500, "effective_from": "2026-01-01"},
        headers=headers,
    )
    payout = client.post(
        "/api/v1/payouts/generate",
        json={"teacher_id": teacher["id"], "period_month": TODAY.month, "period_year": TODAY.year},
        headers=headers,
    ).json()

    approved = client.post(f"/api/v1/payouts/{payout['id']}/approve", headers=headers)
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    regenerate = client.post(
        "/api/v1/payouts/generate",
        json={"teacher_id": teacher["id"], "period_month": TODAY.month, "period_year": TODAY.year},
        headers=headers,
    )
    assert regenerate.status_code == 409

    paid = client.post(f"/api/v1/payouts/{payout['id']}/mark-paid", headers=headers)
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"
    assert paid.json()["paid_at"] is not None


def test_teacher_sees_only_own_payouts(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher_a = _setup(client, headers)
    teacher_b = create_teacher(client, headers, email="other@greenwood.example.com")
    schedule_teacher(client, headers, section["id"], subject["id"], teacher_b["id"])

    for t in (teacher_a, teacher_b):
        client.post(
            "/api/v1/payouts/rates",
            json={"teacher_id": t["id"], "rate_type": "per_session", "rate_value": 500, "effective_from": "2026-01-01"},
            headers=headers,
        )
        client.post(
            "/api/v1/payouts/generate",
            json={"teacher_id": t["id"], "period_month": TODAY.month, "period_year": TODAY.year},
            headers=headers,
        )

    teacher_a_headers = _login(client, teacher_a["email"])
    response = client.get("/api/v1/payouts", headers=teacher_a_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["teacher_id"] == teacher_a["id"]


def test_payouts_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    _, _, _, teacher = _setup(client, headers_a)
    client.post(
        "/api/v1/payouts/rates",
        json={"teacher_id": teacher["id"], "rate_type": "per_session", "rate_value": 500, "effective_from": "2026-01-01"},
        headers=headers_a,
    )

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/payouts/rates", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []
