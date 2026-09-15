"""Backend-enforced RBAC — proves permissions are rejected server-side (403), not just hidden
in the UI. Mirrors the three example cases called out explicitly: a student cannot reach admin
APIs, a teacher cannot modify fee records, and a parent cannot modify student marks."""

from tests.conftest import auth_headers, onboard_and_login_admin


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


def link_parent(client, headers, student_id, email="parent@greenwood.example.com"):
    response = client.post(
        f"/api/v1/students/{student_id}/parents",
        json={"full_name": "Pat Parent", "email": email, "password": "Password123!"},
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
            "day_of_week": 0,
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


def _full_setup(client, headers):
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    schedule_teacher(client, headers, section["id"], subject["id"], teacher["id"])
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"])
    return class_grade, section, subject, teacher, student


def test_student_cannot_access_admin_apis(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher, student = _full_setup(client, headers)
    student_headers = _login(client, student["email"])

    # Reading the academic catalog is admin-only — a student can't reach it at all.
    assert client.get("/api/v1/classes", headers=student_headers).status_code == 403
    assert client.post(
        "/api/v1/classes", json={"name": "Grade 6", "level_order": 6, "academic_year": "2026-2027"}, headers=student_headers
    ).status_code == 403
    # Creating a teacher account is admin-only.
    assert client.post(
        "/api/v1/teachers",
        json={"full_name": "Eve Evil", "email": "eve@greenwood.example.com", "password": "Password123!"},
        headers=student_headers,
    ).status_code == 403
    # Deactivating staff is admin-only.
    assert client.get("/api/v1/staff", headers=student_headers).status_code == 403


def test_teacher_cannot_modify_fee_records(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher, student = _full_setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    assert client.post(
        "/api/v1/fees/plans",
        json={"class_grade_id": class_grade["id"], "academic_year": "2026-2027", "monthly_amount": 4000},
        headers=teacher_headers,
    ).status_code == 403
    assert client.get("/api/v1/fees/plans", headers=teacher_headers).status_code == 403
    assert client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": 1, "period_year": 2027, "due_date": "2027-01-10"},
        headers=teacher_headers,
    ).status_code == 403
    assert client.get("/api/v1/fees/payments/pending", headers=teacher_headers).status_code == 403


def test_parent_cannot_modify_student_marks(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher, student = _full_setup(client, headers)
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    parent_headers = _login(client, "parent@greenwood.example.com")

    assignment = client.post(
        "/api/v1/assignments",
        json={
            "section_id": section["id"],
            "subject_id": subject["id"],
            "title": "Chapter 3 Homework",
            "due_date": "2099-01-01T23:59:00Z",
            "max_marks": 100,
        },
        headers=teacher_headers,
    ).json()
    submission = client.post(
        f"/api/v1/assignments/{assignment['id']}/submit",
        json={"file_url": "/static/uploads/hw.pdf"},
        headers=student_headers,
    ).json()

    # Grading is teacher-only — a parent can never enter or change marks, only view them.
    assert client.post(
        f"/api/v1/assignments/submissions/{submission['id']}/grade",
        json={"marks_obtained": 100, "teacher_feedback": "self-graded"},
        headers=parent_headers,
    ).status_code == 403
    # Parents can't create assignments either.
    assert client.post(
        "/api/v1/assignments",
        json={
            "section_id": section["id"],
            "subject_id": subject["id"],
            "title": "Parent-authored assignment",
            "due_date": "2099-01-01T23:59:00Z",
        },
        headers=parent_headers,
    ).status_code == 403


def test_student_cannot_verify_payments_or_view_payouts(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher, student = _full_setup(client, headers)
    student_headers = _login(client, student["email"])

    assert client.post(
        "/api/v1/fees/payments/00000000-0000-0000-0000-000000000000/verify",
        json={"approve": True},
        headers=student_headers,
    ).status_code == 403
    assert client.get("/api/v1/payouts", headers=student_headers).status_code == 403
    assert client.post(
        "/api/v1/payouts/rates",
        json={
            "teacher_id": teacher["id"],
            "rate_type": "per_session",
            "rate_value": 500,
            "effective_from": "2026-01-01",
        },
        headers=student_headers,
    ).status_code == 403
