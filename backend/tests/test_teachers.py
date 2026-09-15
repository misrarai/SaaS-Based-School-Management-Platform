from tests.conftest import auth_headers, onboard_and_login_admin


def create_teacher(client, headers, email="tom@greenwood.example.com"):
    response = client.post(
        "/api/v1/teachers",
        json={
            "full_name": "Tom Teacher",
            "email": email,
            "password": "Password123!",
            "qualification": "M.Sc Physics",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_admin_creates_and_lists_teacher(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    teacher = create_teacher(client, headers)
    assert teacher["email"] == "tom@greenwood.example.com"
    assert teacher["qualification"] == "M.Sc Physics"

    response = client.get("/api/v1/teachers", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_teacher_can_log_in(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "tom@greenwood.example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200

    me = client.get("/api/v1/auth/me", headers=auth_headers(login_resp.json()))
    assert me.json()["role"] == "teacher"


def test_duplicate_teacher_email_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)

    response = client.post(
        "/api/v1/teachers",
        json={"full_name": "Another Tom", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert response.status_code == 409


def test_deactivating_teacher_forces_logout(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    teacher = create_teacher(client, headers)

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "tom@greenwood.example.com", "password": "Password123!"},
    )
    teacher_tokens = login_resp.json()

    update_resp = client.patch(
        f"/api/v1/teachers/{teacher['id']}", json={"is_active": False}, headers=headers
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["is_active"] is False

    me = client.get("/api/v1/auth/me", headers=auth_headers(teacher_tokens))
    assert me.status_code == 401
