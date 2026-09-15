from tests.conftest import auth_headers, onboard_and_login_admin


def create_family(client, headers, name="Ahmad Family"):
    response = client.post(
        "/api/v1/families",
        json={"family_name": name, "cnic": "1234567890123", "phone": "03001234567"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_create_and_list_families(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    family = create_family(client, headers)
    assert family["family_name"] == "Ahmad Family"
    assert family["family_number"] == "1"

    response = client.get("/api/v1/families", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_family_numbers_increment_sequentially(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    f1 = create_family(client, headers, name="Family One")
    f2 = create_family(client, headers, name="Family Two")
    assert f1["family_number"] == "1"
    assert f2["family_number"] == "2"


def test_search_families_by_name(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_family(client, headers, name="Zamir Family")
    create_family(client, headers, name="Bilal Family")

    response = client.get("/api/v1/families?q=Zamir", headers=headers)
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["family_name"] == "Zamir Family"


def test_family_students_endpoint_lists_siblings(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    family = create_family(client, headers)
    class_grade = create_class(client, headers)

    for i in range(2):
        resp = client.post(
            "/api/v1/students",
            json={
                "full_name": f"Sibling {i}",
                "email": f"sibling{i}@greenwood.example.com",
                "password": "Password123!",
                "class_grade_id": class_grade["id"],
                "family_id": family["id"],
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text

    response = client.get(f"/api/v1/families/{family['id']}/students", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_family_not_found_in_other_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    family = create_family(client, headers_a)

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)

    response = client.get(f"/api/v1/families/{family['id']}", headers=headers_b)
    assert response.status_code == 404


def test_creating_student_with_family_from_another_tenant_rejected(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    family_a = create_family(client, headers_a)

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    class_b = create_class(client, headers_b)

    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Cross Tenant Student",
            "email": "cross@riverside.example.com",
            "password": "Password123!",
            "class_grade_id": class_b["id"],
            "family_id": family_a["id"],
        },
        headers=headers_b,
    )
    assert response.status_code == 404
