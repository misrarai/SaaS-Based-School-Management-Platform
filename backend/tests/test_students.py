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


def test_admin_creates_student_in_class_and_section(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])

    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "section_id": section["id"],
            "roll_number": "5A-01",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["class_grade_id"] == class_grade["id"]
    assert body["section_id"] == section["id"]
    assert body["status"] == "active"


def test_student_creation_rejects_section_from_another_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_a = create_class(client, headers, name="Grade 5", level_order=5)
    class_b = create_class(client, headers, name="Grade 6", level_order=6)
    section_of_b = create_section(client, headers, class_b["id"])

    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_a["id"],
            "section_id": section_of_b["id"],
        },
        headers=headers,
    )
    assert response.status_code == 409


def test_list_students_filtered_by_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_a = create_class(client, headers, name="Grade 5", level_order=5)
    class_b = create_class(client, headers, name="Grade 6", level_order=6)

    client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_a["id"],
        },
        headers=headers,
    )
    client.post(
        "/api/v1/students",
        json={
            "full_name": "Alex Student",
            "email": "alex@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_b["id"],
        },
        headers=headers,
    )

    response = client.get(f"/api/v1/students?class_grade_id={class_a['id']}", headers=headers)
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["full_name"] == "Sam Student"


def test_student_can_log_in_and_gets_student_role(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "sam@greenwood.example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    me = client.get("/api/v1/auth/me", headers=auth_headers(login_resp.json()))
    assert me.json()["role"] == "student"


def test_student_can_fetch_own_profile_via_me(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "roll_number": "5A-01",
        },
        headers=headers,
    )
    student = create_resp.json()

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "sam@greenwood.example.com", "password": "Password123!"},
    )
    student_headers = auth_headers(login_resp.json())

    response = client.get("/api/v1/students/me", headers=student_headers)
    assert response.status_code == 200
    assert response.json()["id"] == student["id"]
    assert response.json()["roll_number"] == "5A-01"

    admin_response = client.get("/api/v1/students/me", headers=headers)
    assert admin_response.status_code == 403


def test_student_of_one_school_not_visible_to_another(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    class_a = create_class(client, headers_a)
    student_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_a["id"],
        },
        headers=headers_a,
    )
    student_id = student_resp.json()["id"]

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)

    response = client.get(f"/api/v1/students/{student_id}", headers=headers_b)
    assert response.status_code == 404
