import os

# Must be set BEFORE any app module is imported so that get_settings() (which
# is cached via @lru_cache) picks up ENVIRONMENT=testing and disables the
# slowapi rate-limiter for the test suite.
os.environ.setdefault("ENVIRONMENT", "testing")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app import models  # noqa: F401 ensures all models are registered
from app.db.base import Base
from app.db.session import build_engine, get_db
from app.main import app


@pytest.fixture()
def db_session():
    engine = build_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def onboard_school(client, slug="greenwood", admin_email="admin@greenwood.example.com", admin_password="Password123!"):
    response = client.post(
        "/api/v1/tenants/onboard",
        json={
            "school_name": f"{slug.title()} School",
            "slug": slug,
            "contact_email": f"office@{slug}.example.com",
            "admin_full_name": "Alice Admin",
            "admin_email": admin_email,
            "admin_password": admin_password,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def login(client, slug, email, password):
    response = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()


def auth_headers(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def onboard_and_login_admin(client, slug="greenwood"):
    admin_email = f"admin@{slug}.example.com"
    onboard_school(client, slug=slug, admin_email=admin_email)
    return login(client, slug, admin_email, "Password123!")
