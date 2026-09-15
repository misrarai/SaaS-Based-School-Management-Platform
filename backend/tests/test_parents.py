from tests.conftest import auth_headers, login, onboard_and_login_admin, onboard_school


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


def link_parent(client, headers, student_id, email="parent@greenwood.example.com", relationship_label="Father"):
    response = client.post(
        f"/api/v1/students/{student_id}/parents",
        json={
            "full_name": "Pat Parent",
            "email": email,
            "password": "Password123!",
            "relationship_label": relationship_label,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_admin_creates_and_links_parent(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])

    link_parent(client, headers, student["id"])

    parent_login = login(client, "greenwood", "parent@greenwood.example.com", "Password123!")
    me = client.get("/api/v1/auth/me", headers=auth_headers(parent_login))
    assert me.json()["role"] == "parent"


def test_parent_can_list_own_children(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])
    link_parent(client, headers, student["id"])

    parent_tokens = login(client, "greenwood", "parent@greenwood.example.com", "Password123!")
    response = client.get("/api/v1/parents/me/children", headers=auth_headers(parent_tokens))
    assert response.status_code == 200
    children = response.json()
    assert len(children) == 1
    assert children[0]["id"] == student["id"]


def test_same_parent_email_reused_for_second_child(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student_a = create_student(client, headers, class_grade["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], email="b@greenwood.example.com")

    link_parent(client, headers, student_a["id"])
    link_parent(client, headers, student_b["id"])

    parent_tokens = login(client, "greenwood", "parent@greenwood.example.com", "Password123!")
    response = client.get("/api/v1/parents/me/children", headers=auth_headers(parent_tokens))
    assert response.status_code == 200
    assert {c["id"] for c in response.json()} == {student_a["id"], student_b["id"]}


def test_linking_same_parent_to_same_student_twice_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])
    link_parent(client, headers, student["id"])

    response = client.post(
        f"/api/v1/students/{student['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert response.status_code == 409


def test_non_admin_cannot_link_parent(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])

    onboard_school(client, slug="riverside", admin_email="admin@riverside.example.com")
    other_tokens = login(client, "riverside", "admin@riverside.example.com", "Password123!")

    response = client.post(
        f"/api/v1/students/{student['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@riverside.example.com", "password": "Password123!"},
        headers=auth_headers(other_tokens),
    )
    assert response.status_code == 404  # student not found in this admin's tenant
