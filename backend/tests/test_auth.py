import re

from tests.conftest import auth_headers, login, onboard_and_login_admin, onboard_school


def _capture_emails(monkeypatch):
    sent = []

    def fake_send(self, to_email, subject, body_text):
        sent.append({"to": to_email, "subject": subject, "body": body_text})
        return True

    monkeypatch.setattr("app.services.email_service.EmailService.send", fake_send)
    return sent


def _extract_token(body_text):
    match = re.search(r"token=([\w-]+)", body_text)
    assert match, f"no token found in email body: {body_text}"
    return match.group(1)


def test_onboard_creates_tenant_and_admin(client):
    data = onboard_school(client)
    assert data["tenant"]["slug"] == "greenwood"
    assert data["admin"]["role"] == "admin"
    assert data["admin"]["email"] == "admin@greenwood.example.com"


def test_duplicate_slug_rejected(client):
    onboard_school(client)
    response = client.post(
        "/api/v1/tenants/onboard",
        json={
            "school_name": "Greenwood School",
            "slug": "greenwood",
            "contact_email": "office@greenwood.example.com",
            "admin_full_name": "Bob Admin",
            "admin_email": "bob@greenwood.example.com",
            "admin_password": "Password123!",
        },
    )
    assert response.status_code == 409


def test_login_success_and_me(client):
    onboard_school(client)
    tokens = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")
    assert "access_token" in tokens and "refresh_token" in tokens

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "admin@greenwood.example.com"


def test_login_wrong_password_rejected(client):
    onboard_school(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "admin@greenwood.example.com", "password": "wrong"},
    )
    assert response.status_code == 401


def test_login_wrong_tenant_slug_rejected(client):
    onboard_school(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "does-not-exist", "email": "admin@greenwood.example.com", "password": "Password123!"},
    )
    assert response.status_code == 401


def test_refresh_token_issues_new_access_token(client):
    onboard_school(client)
    tokens = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_unauthenticated_me_rejected(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_new_admin_is_unverified_and_receives_verification_email(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    data = onboard_school(client)
    assert data["admin"]["is_verified"] is False
    assert len(sent) == 1
    assert sent[0]["to"] == "admin@greenwood.example.com"
    assert "verify-email?token=" in sent[0]["body"]


def test_verify_email_marks_user_verified(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    onboard_school(client)
    token = _extract_token(sent[0]["body"])

    response = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 200

    tokens = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")
    me = client.get("/api/v1/auth/me", headers=auth_headers(tokens))
    assert me.json()["is_verified"] is True


def test_verify_email_rejects_bad_token(client):
    onboard_school(client)
    response = client.post("/api/v1/auth/verify-email", json={"token": "not-a-real-token"})
    assert response.status_code == 401


def test_resend_verification_rejected_once_already_verified(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    onboard_school(client)
    token = _extract_token(sent[0]["body"])
    client.post("/api/v1/auth/verify-email", json={"token": token})

    tokens = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")
    response = client.post("/api/v1/auth/resend-verification", headers=auth_headers(tokens))
    assert response.status_code == 409


def test_login_blocked_when_verification_required_and_not_verified(client, monkeypatch):
    monkeypatch.setattr("app.services.auth_service.settings.REQUIRE_EMAIL_VERIFICATION", True)
    onboard_school(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "admin@greenwood.example.com", "password": "Password123!"},
    )
    assert response.status_code == 401


def test_login_allowed_after_verification_when_required(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    onboard_school(client)
    token = _extract_token(sent[0]["body"])
    client.post("/api/v1/auth/verify-email", json={"token": token})

    monkeypatch.setattr("app.services.auth_service.settings.REQUIRE_EMAIL_VERIFICATION", True)
    response = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "admin@greenwood.example.com", "password": "Password123!"},
    )
    assert response.status_code == 200


def test_admin_created_teacher_is_verified_by_default(client, monkeypatch):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    response = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert response.status_code == 201

    # Admin-provisioned accounts default to verified — even with verification enforced,
    # a teacher the admin just created can still log in without ever touching a verification email.
    monkeypatch.setattr("app.services.auth_service.settings.REQUIRE_EMAIL_VERIFICATION", True)
    login_response = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "tom@greenwood.example.com", "password": "Password123!"},
    )
    assert login_response.status_code == 200


def test_logout_invalidates_existing_tokens(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.post("/api/v1/auth/logout", headers=headers)
    assert response.status_code == 200

    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 401

    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 401


def test_forgot_password_and_reset_round_trip(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    onboard_school(client)
    sent.clear()  # drop the verification email from onboarding

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"tenant_slug": "greenwood", "email": "admin@greenwood.example.com"},
    )
    assert response.status_code == 200
    assert len(sent) == 1
    token = _extract_token(sent[0]["body"])

    reset = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "NewPassword456!"})
    assert reset.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "admin@greenwood.example.com", "password": "Password123!"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "admin@greenwood.example.com", "password": "NewPassword456!"},
    )
    assert new_login.status_code == 200


def test_forgot_password_unknown_email_returns_generic_success(client):
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"tenant_slug": "greenwood", "email": "nobody@greenwood.example.com"},
    )
    assert response.status_code == 200
    assert "detail" not in response.json()


def test_reset_password_rejects_bad_token(client):
    response = client.post(
        "/api/v1/auth/reset-password", json={"token": "not-a-real-token", "new_password": "NewPassword456!"}
    )
    assert response.status_code == 401


def test_reset_password_token_is_single_use(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    onboard_school(client)
    sent.clear()
    client.post(
        "/api/v1/auth/forgot-password",
        json={"tenant_slug": "greenwood", "email": "admin@greenwood.example.com"},
    )
    token = _extract_token(sent[0]["body"])

    first = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "NewPassword456!"})
    assert first.status_code == 200

    second = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "AnotherOne789!"})
    assert second.status_code == 401


def test_change_password_requires_correct_current_password(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    wrong = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongPassword!", "new_password": "NewPassword456!"},
        headers=headers,
    )
    assert wrong.status_code == 401


def test_change_password_success_invalidates_old_session(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Password123!", "new_password": "NewPassword456!"},
        headers=headers,
    )
    assert response.status_code == 200

    stale = client.get("/api/v1/auth/me", headers=headers)
    assert stale.status_code == 401

    relogin = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "admin@greenwood.example.com", "password": "NewPassword456!"},
    )
    assert relogin.status_code == 200
