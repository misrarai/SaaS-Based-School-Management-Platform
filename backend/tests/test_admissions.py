from tests.conftest import auth_headers, onboard_and_login_admin


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_student(client, headers, class_id, email="sam@greenwood.example.com", full_name="Sam Student"):
    response = client.post(
        "/api/v1/students",
        json={
            "full_name": full_name,
            "email": email,
            "password": "Password123!",
            "class_grade_id": class_id,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_admission_numbers_are_sequential_per_tenant(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    s1 = create_student(client, headers, class_grade["id"], email="s1@greenwood.example.com")
    s2 = create_student(client, headers, class_grade["id"], email="s2@greenwood.example.com")

    assert s1["admission_number"] == "1"
    assert s2["admission_number"] == "2"


def test_teacher_can_register_a_student(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    teacher_resp = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tina Teacher", "email": "tina@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert teacher_resp.status_code == 201

    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "tina@greenwood.example.com", "password": "Password123!"},
    )
    teacher_headers = auth_headers(teacher_login.json())

    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=teacher_headers,
    )
    assert response.status_code == 201, response.text


def test_withdraw_student_blocks_login_and_moves_to_old_students(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])

    student_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "sam@greenwood.example.com", "password": "Password123!"},
    )
    student_tokens = student_login.json()

    withdraw_resp = client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        json={"reason": "Relocated to another city"},
        headers=headers,
    )
    assert withdraw_resp.status_code == 200
    assert withdraw_resp.json()["status"] == "withdrawn"

    me = client.get("/api/v1/auth/me", headers=auth_headers(student_tokens))
    assert me.status_code == 401

    active = client.get("/api/v1/students?status=active", headers=headers)
    assert student["id"] not in [s["id"] for s in active.json()]

    old = client.get("/api/v1/students?status=old", headers=headers)
    assert student["id"] in [s["id"] for s in old.json()]

    admission_register = client.get("/api/v1/students?status=all", headers=headers)
    assert student["id"] in [s["id"] for s in admission_register.json()]


def test_reactivate_student_restores_login(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])

    client.post(f"/api/v1/students/{student['id']}/withdraw", json={}, headers=headers)
    reactivate_resp = client.post(f"/api/v1/students/{student['id']}/reactivate", headers=headers)
    assert reactivate_resp.status_code == 200
    assert reactivate_resp.json()["status"] == "active"

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "sam@greenwood.example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
