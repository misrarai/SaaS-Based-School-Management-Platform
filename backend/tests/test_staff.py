from tests.conftest import auth_headers, onboard_and_login_admin


def create_staff(client, headers, name="Liaqat Ali", designation="Principal"):
    response = client.post(
        "/api/v1/staff",
        json={"full_name": name, "designation": designation, "phone": "03011016102", "salary": 70000},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_create_and_list_staff(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    member = create_staff(client, headers)
    assert member["designation"] == "Principal"
    assert member["employee_code"] == "1"
    assert member["status"] == "active"

    response = client.get("/api/v1/staff", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_employee_codes_increment_sequentially(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    s1 = create_staff(client, headers, name="Liaqat Ali", designation="Principal")
    s2 = create_staff(client, headers, name="Shaukat Ali", designation="Accountant")
    assert s1["employee_code"] == "1"
    assert s2["employee_code"] == "2"


def test_search_staff_by_name_and_designation(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_staff(client, headers, name="Liaqat Ali", designation="Principal")
    create_staff(client, headers, name="Mehwish", designation="Teacher")

    by_name = client.get("/api/v1/staff?q=Mehwish", headers=headers)
    assert len(by_name.json()) == 1
    assert by_name.json()[0]["full_name"] == "Mehwish"

    by_designation = client.get("/api/v1/staff?q=Principal", headers=headers)
    assert len(by_designation.json()) == 1
    assert by_designation.json()[0]["full_name"] == "Liaqat Ali"


def test_set_staff_status_to_inactive_and_filter(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    member = create_staff(client, headers)

    response = client.post(f"/api/v1/staff/{member['id']}/status", json={"status": "inactive"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "inactive"

    active = client.get("/api/v1/staff?status=active", headers=headers)
    assert active.json() == []

    inactive = client.get("/api/v1/staff?status=inactive", headers=headers)
    assert len(inactive.json()) == 1


def test_staff_of_one_school_not_visible_to_another(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    member = create_staff(client, headers_a)

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)

    response = client.get(f"/api/v1/staff/{member['id']}", headers=headers_b)
    assert response.status_code == 404


def test_teacher_cannot_manage_staff(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "tom@greenwood.example.com", "password": "Password123!"},
    )
    teacher_headers = auth_headers(teacher_login.json())

    response = client.post(
        "/api/v1/staff",
        json={"full_name": "Someone", "designation": "Peon"},
        headers=teacher_headers,
    )
    assert response.status_code == 403
