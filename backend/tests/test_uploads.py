import io

from tests.conftest import auth_headers, onboard_and_login_admin


def test_upload_image_returns_url(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    fake_png = b"\x89PNG\r\n\x1a\n" + b"0" * 20
    response = client.post(
        "/api/v1/uploads/images",
        headers=headers,
        files={"file": ("photo.png", io.BytesIO(fake_png), "image/png")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["url"].startswith("/static/uploads/")
    assert body["url"].endswith(".png")


def test_upload_image_rejects_unsupported_type(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.post(
        "/api/v1/uploads/images",
        headers=headers,
        files={"file": ("resume.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert response.status_code == 400


def test_upload_image_requires_auth(client):
    fake_png = b"\x89PNG\r\n\x1a\n" + b"0" * 20
    response = client.post(
        "/api/v1/uploads/images",
        files={"file": ("photo.png", io.BytesIO(fake_png), "image/png")},
    )
    assert response.status_code == 401
