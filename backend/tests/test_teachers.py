from tests.conftest import auth_headers, login, onboard_and_login_admin, onboard_school


def create_teacher(client, headers, email="tom@greenwood.example.com", extra=None):
    payload = {
        "full_name": "Tom Teacher",
        "email": email,
        "password": "Password123!",
        "qualification": "M.Sc Physics",
    }
    if extra:
        payload.update(extra)
    response = client.post("/api/v1/teachers", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


# ── Core CRUD ────────────────────────────────────────────────────────────────


def test_admin_creates_and_lists_teacher(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    teacher = create_teacher(client, headers)
    assert teacher["email"] == "tom@greenwood.example.com"
    assert teacher["qualification"] == "M.Sc Physics"

    response = client.get("/api/v1/teachers", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_create_teacher_with_all_fields(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    teacher = create_teacher(client, headers, extra={
        "phone_number": "0300-1234567",
        "employee_code": "TCH-001",
        "hire_date": "2024-01-15",
    })
    assert teacher["phone_number"] == "0300-1234567"
    assert teacher["employee_code"] == "TCH-001"
    assert teacher["hire_date"] == "2024-01-15"


def test_get_teacher_by_id(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    teacher = create_teacher(client, headers)

    response = client.get(f"/api/v1/teachers/{teacher['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == teacher["id"]
    assert response.json()["email"] == teacher["email"]


def test_update_teacher_fields(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    teacher = create_teacher(client, headers)

    update_resp = client.patch(
        f"/api/v1/teachers/{teacher['id']}",
        json={
            "full_name": "Tom Updated",
            "phone_number": "0321-9876543",
            "qualification": "Ph.D Physics",
            "employee_code": "TCH-999",
            "hire_date": "2023-09-01",
        },
        headers=headers,
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["full_name"] == "Tom Updated"
    assert data["phone_number"] == "0321-9876543"
    assert data["qualification"] == "Ph.D Physics"
    assert data["employee_code"] == "TCH-999"
    assert data["hire_date"] == "2023-09-01"


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


def test_teacher_can_get_own_profile(client):
    tokens = onboard_and_login_admin(client)
    admin_headers = auth_headers(tokens)
    create_teacher(client, admin_headers, extra={"employee_code": "T-42", "hire_date": "2024-03-01"})

    teacher_tokens = login(client, "greenwood", "tom@greenwood.example.com", "Password123!")
    teacher_headers = auth_headers(teacher_tokens)

    resp = client.get("/api/v1/teachers/me", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "tom@greenwood.example.com"
    assert resp.json()["employee_code"] == "T-42"


def test_teacher_can_update_own_profile(client):
    tokens = onboard_and_login_admin(client)
    admin_headers = auth_headers(tokens)
    create_teacher(client, admin_headers)

    teacher_tokens = login(client, "greenwood", "tom@greenwood.example.com", "Password123!")
    teacher_headers = auth_headers(teacher_tokens)

    resp = client.patch(
        "/api/v1/teachers/me",
        json={"full_name": "Tom Self-Updated", "phone_number": "0300-0000001"},
        headers=teacher_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Tom Self-Updated"


def test_teacher_cannot_deactivate_self(client):
    tokens = onboard_and_login_admin(client)
    admin_headers = auth_headers(tokens)
    create_teacher(client, admin_headers)

    teacher_tokens = login(client, "greenwood", "tom@greenwood.example.com", "Password123!")
    teacher_headers = auth_headers(teacher_tokens)

    resp = client.patch(
        "/api/v1/teachers/me",
        json={"is_active": False},
        headers=teacher_headers,
    )
    # endpoint strips is_active — teacher should still be active
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


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


# ── Search & Filter ──────────────────────────────────────────────────────────


def test_search_by_name(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers, email="tom@greenwood.example.com")
    create_teacher(client, headers, email="sara@greenwood.example.com",
                   extra={"full_name": "Sara Smith"})

    resp = client.get("/api/v1/teachers?q=Sara", headers=headers)
    assert resp.status_code == 200
    names = [t["full_name"] for t in resp.json()]
    assert "Sara Smith" in names
    assert "Tom Teacher" not in names


def test_filter_by_active_status(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    t1 = create_teacher(client, headers, email="active@greenwood.example.com")
    t2 = create_teacher(client, headers, email="inactive@greenwood.example.com",
                        extra={"full_name": "Inactive Teacher"})
    client.patch(f"/api/v1/teachers/{t2['id']}", json={"is_active": False}, headers=headers)

    active_resp = client.get("/api/v1/teachers?is_active=true", headers=headers)
    assert active_resp.status_code == 200
    ids = [t["id"] for t in active_resp.json()]
    assert t1["id"] in ids
    assert t2["id"] not in ids

    inactive_resp = client.get("/api/v1/teachers?is_active=false", headers=headers)
    assert inactive_resp.status_code == 200
    ids = [t["id"] for t in inactive_resp.json()]
    assert t2["id"] in ids
    assert t1["id"] not in ids


# ── Permissions & Tenant Isolation ──────────────────────────────────────────


def test_non_admin_cannot_list_teachers(client):
    tokens = onboard_and_login_admin(client)
    admin_headers = auth_headers(tokens)
    create_teacher(client, admin_headers)

    teacher_tokens = login(client, "greenwood", "tom@greenwood.example.com", "Password123!")
    resp = client.get("/api/v1/teachers", headers=auth_headers(teacher_tokens))
    assert resp.status_code == 403


def test_non_admin_cannot_create_teacher(client):
    tokens = onboard_and_login_admin(client)
    admin_headers = auth_headers(tokens)
    create_teacher(client, admin_headers)

    teacher_tokens = login(client, "greenwood", "tom@greenwood.example.com", "Password123!")
    resp = client.post(
        "/api/v1/teachers",
        json={"full_name": "Hacker", "email": "h@x.com", "password": "Password123!"},
        headers=auth_headers(teacher_tokens),
    )
    assert resp.status_code == 403


def test_tenant_isolation(client):
    # School A
    onboard_school(client, slug="schoola", admin_email="admin@schoola.example.com")
    tokens_a = login(client, "schoola", "admin@schoola.example.com", "Password123!")
    headers_a = auth_headers(tokens_a)
    create_teacher(client, headers_a, email="teacher@schoola.example.com")

    # School B
    onboard_school(client, slug="schoolb", admin_email="admin@schoolb.example.com")
    tokens_b = login(client, "schoolb", "admin@schoolb.example.com", "Password123!")
    headers_b = auth_headers(tokens_b)

    # School B admin sees no teachers from school A
    resp = client.get("/api/v1/teachers", headers=headers_b)
    assert resp.status_code == 200
    assert len(resp.json()) == 0
