from tests.conftest import auth_headers, onboard_and_login_admin


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_student(client, headers, class_id, email="sam@greenwood.example.com"):
    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": email,
            "password": "Password123!",
            "class_grade_id": class_id,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def test_admin_downloads_report_card(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])

    response = client.get(f"/api/v1/students/{student['id']}/report-card", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content[:4] == b"%PDF"


def test_admin_downloads_id_card(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])

    response = client.get(f"/api/v1/students/{student['id']}/id-card", headers=headers)
    assert response.status_code == 200
    assert response.content[:4] == b"%PDF"


def test_admin_downloads_certificate(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])

    response = client.get(f"/api/v1/students/{student['id']}/certificate", headers=headers)
    assert response.status_code == 200
    assert response.content[:4] == b"%PDF"


def test_student_can_download_own_report_card_but_not_someone_elses(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student_a = create_student(client, headers, class_grade["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], email="b@greenwood.example.com")
    student_a_headers = _login(client, "a@greenwood.example.com")

    own = client.get(f"/api/v1/students/{student_a['id']}/report-card", headers=student_a_headers)
    assert own.status_code == 200

    others = client.get(f"/api/v1/students/{student_b['id']}/report-card", headers=student_a_headers)
    assert others.status_code == 403
