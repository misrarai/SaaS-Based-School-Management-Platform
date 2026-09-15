from tests.conftest import auth_headers, onboard_and_login_admin


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
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


def create_student(client, headers, class_id, email="sam@greenwood.example.com"):
    response = client.post(
        "/api/v1/students",
        json={"full_name": "Sam Student", "email": email, "password": "Password123!", "class_grade_id": class_id},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def test_admin_creates_link_resource(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    subject = create_subject(client, headers, class_grade["id"])

    response = client.post(
        "/api/v1/resources",
        json={
            "title": "Khan Academy — Fractions",
            "resource_type": "link",
            "external_url": "https://www.khanacademy.org/math/fractions",
            "class_grade_id": class_grade["id"],
            "subject_id": subject["id"],
            "category": "Video Lectures",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["resource_type"] == "link"
    assert body["external_url"].startswith("https://")


def test_link_resource_requires_external_url(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.post("/api/v1/resources", json={"title": "Bad link", "resource_type": "link"}, headers=headers)
    assert response.status_code == 422


def test_document_resource_requires_file_url(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.post(
        "/api/v1/resources", json={"title": "Bad doc", "resource_type": "document"}, headers=headers
    )
    assert response.status_code == 422


def test_teacher_creates_document_resource(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    response = client.post(
        "/api/v1/resources",
        json={"title": "Past Paper 2023", "resource_type": "document", "file_url": "/static/uploads/fake.pdf", "category": "Past Papers"},
        headers=teacher_headers,
    )
    assert response.status_code == 201, response.text


def test_student_sees_only_resources_for_their_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_a = create_class(client, headers, name="Grade 5", level_order=5)
    class_b = create_class(client, headers, name="Grade 6", level_order=6)
    create_student(client, headers, class_a["id"])

    client.post(
        "/api/v1/resources",
        json={"title": "Grade 5 resource", "resource_type": "link", "external_url": "https://example.com/a", "class_grade_id": class_a["id"]},
        headers=headers,
    )
    client.post(
        "/api/v1/resources",
        json={"title": "Grade 6 resource", "resource_type": "link", "external_url": "https://example.com/b", "class_grade_id": class_b["id"]},
        headers=headers,
    )

    student_headers = _login(client, "sam@greenwood.example.com")
    response = client.get("/api/v1/resources", headers=student_headers)
    assert response.status_code == 200
    titles = [r["title"] for r in response.json()]
    assert titles == ["Grade 5 resource"]


def test_teacher_can_only_delete_own_upload(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers, email="a@greenwood.example.com")
    create_teacher(client, headers, email="b@greenwood.example.com")
    a_headers = _login(client, "a@greenwood.example.com")
    b_headers = _login(client, "b@greenwood.example.com")

    created = client.post(
        "/api/v1/resources",
        json={"title": "A's resource", "resource_type": "link", "external_url": "https://example.com/a"},
        headers=a_headers,
    ).json()

    forbidden = client.delete(f"/api/v1/resources/{created['id']}", headers=b_headers)
    assert forbidden.status_code == 403

    ok = client.delete(f"/api/v1/resources/{created['id']}", headers=a_headers)
    assert ok.status_code == 204


def test_admin_can_delete_any_resource(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    created = client.post(
        "/api/v1/resources",
        json={"title": "Teacher's resource", "resource_type": "link", "external_url": "https://example.com/a"},
        headers=teacher_headers,
    ).json()

    response = client.delete(f"/api/v1/resources/{created['id']}", headers=headers)
    assert response.status_code == 204


def test_resources_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    client.post(
        "/api/v1/resources",
        json={"title": "Greenwood resource", "resource_type": "link", "external_url": "https://example.com/a"},
        headers=headers_a,
    )

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/resources", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []
