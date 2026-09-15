from tests.conftest import login, onboard_school


def test_admin_of_one_school_cannot_see_another_schools_tenant(client):
    onboard_school(client, slug="greenwood", admin_email="admin@greenwood.example.com")
    onboard_school(client, slug="riverside", admin_email="admin@riverside.example.com")

    tokens_a = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")
    tokens_b = login(client, "riverside", "admin@riverside.example.com", "Password123!")

    resp_a = client.get("/api/v1/tenants/me", headers={"Authorization": f"Bearer {tokens_a['access_token']}"})
    resp_b = client.get("/api/v1/tenants/me", headers={"Authorization": f"Bearer {tokens_b['access_token']}"})

    assert resp_a.status_code == 200
    assert resp_b.status_code == 200
    assert resp_a.json()["slug"] == "greenwood"
    assert resp_b.json()["slug"] == "riverside"
    assert resp_a.json()["id"] != resp_b.json()["id"]


def test_cannot_login_to_another_tenant_with_same_email_pattern(client):
    onboard_school(client, slug="greenwood", admin_email="admin@school.example.com")
    onboard_school(client, slug="riverside", admin_email="someoneelse@school.example.com")

    # Same-looking email that only exists in "riverside" must not authenticate against "greenwood".
    response = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "someoneelse@school.example.com", "password": "Password123!"},
    )
    assert response.status_code == 401


def test_access_token_tenant_claim_is_trusted_source_for_scoping(client):
    onboard_school(client, slug="greenwood", admin_email="admin@greenwood.example.com")
    tokens = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    tenant_me = client.get("/api/v1/tenants/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})

    assert me.json()["tenant_id"] == tenant_me.json()["id"]
