from datetime import date

import httpx

import app.services.google_calendar_service as google_calendar_service
from tests.conftest import auth_headers, onboard_and_login_admin
from tests.test_schedule import create_class, create_section, create_subject, create_teacher

SESSION_DATE = date(2026, 9, 20)


def _teacher_headers(client, email="tom@greenwood.example.com"):
    resp = client.post(
        "/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": "Password123!"}
    )
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def _setup(client, headers):
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    return class_grade, section, subject, teacher


def _online_class_payload(section, subject, teacher, title="Mathematics Online Class", **overrides):
    payload = {
        "section_id": section["id"],
        "subject_id": subject["id"],
        "teacher_id": teacher["id"],
        "session_date": SESSION_DATE.isoformat(),
        "start_time": "10:00:00",
        "end_time": "11:00:00",
        "title": title,
        "description": "Grade 10 Mathematics Class",
    }
    payload.update(overrides)
    return payload


class FakeGoogleResponse:
    def __init__(self, status_code=200, json_body=None):
        self.status_code = status_code
        self._json_body = json_body or {}

    def json(self):
        return self._json_body

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://www.googleapis.com/fake")
            response = httpx.Response(self.status_code, request=request, json=self._json_body)
            raise httpx.HTTPStatusError("error", request=request, response=response)


def _success_event_response(event_id="evt123", meet_uri="https://meet.google.com/abc-defg-hij"):
    return FakeGoogleResponse(
        200,
        {
            "id": event_id,
            "conferenceData": {"entryPoints": [{"entryPointType": "video", "uri": meet_uri}]},
        },
    )


def _bypass_access_token(monkeypatch, calendar_id="primary"):
    """Skips the real OAuth refresh-token round trip (no connection row needed) so tests can
    focus purely on the Calendar Events API call and its request/response handling."""
    monkeypatch.setattr(
        google_calendar_service.GoogleCalendarService,
        "_get_access_token",
        lambda self, tenant_id: ("fake-access-token", calendar_id),
    )


def test_admin_can_create_online_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)

    response = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=headers
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Mathematics Online Class"
    assert body["description"] == "Grade 10 Mathematics Class"
    # Google isn't connected in this test — creation must still succeed, just without a Meet link.
    assert body["meeting_status"] == "failed"
    assert body["meet_link"] is None


def test_teacher_can_create_own_online_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    teacher_headers = _teacher_headers(client)

    response = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=teacher_headers
    )
    assert response.status_code == 201, response.text


def test_teacher_cannot_create_online_class_for_another_teacher(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    create_teacher(client, headers, email="other@greenwood.example.com")
    other_headers = _teacher_headers(client, email="other@greenwood.example.com")

    response = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=other_headers
    )
    assert response.status_code == 403


def test_student_cannot_create_online_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "section_id": section["id"],
        },
        headers=headers,
    )
    assert student.status_code == 201, student.text
    student_headers = _teacher_headers(client, email="sam@greenwood.example.com")

    response = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=student_headers
    )
    assert response.status_code == 403


def test_invalid_datetime_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)

    response = client.post(
        "/api/v1/schedule/sessions",
        json=_online_class_payload(section, subject, teacher, start_time="11:00:00", end_time="10:00:00"),
        headers=headers,
    )
    assert response.status_code == 409


def test_google_event_created_and_meet_link_saved_and_returned(client, monkeypatch):
    _bypass_access_token(monkeypatch)
    calls = []

    def fake_post(url, params=None, headers=None, json=None, timeout=None):
        calls.append({"url": url, "params": params, "json": json})
        return _success_event_response()

    monkeypatch.setattr(google_calendar_service.httpx, "post", fake_post)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)

    response = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=headers
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["meeting_status"] == "created"
    assert body["meet_link"] == "https://meet.google.com/abc-defg-hij"
    assert body["google_event_id"] == "evt123"
    assert body["google_calendar_id"] == "primary"
    # the generic join-link field used by the rest of the app must be kept in sync
    assert body["meeting_url"] == "https://meet.google.com/abc-defg-hij"

    assert len(calls) == 1
    assert calls[0]["params"] == {"conferenceDataVersion": 1}
    sent = calls[0]["json"]
    assert sent["conferenceData"]["createRequest"]["conferenceSolutionKey"]["type"] == "hangoutsMeet"
    assert sent["conferenceData"]["createRequest"]["requestId"]  # unique per event


def test_timezone_is_asia_karachi(client, monkeypatch):
    _bypass_access_token(monkeypatch)
    calls = []

    def fake_post(url, params=None, headers=None, json=None, timeout=None):
        calls.append(json)
        return _success_event_response()

    monkeypatch.setattr(google_calendar_service.httpx, "post", fake_post)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    client.post("/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=headers)

    sent = calls[0]
    assert sent["start"]["timeZone"] == "Asia/Karachi"
    assert sent["end"]["timeZone"] == "Asia/Karachi"
    assert sent["start"]["dateTime"] == "2026-09-20T10:00:00+05:00"
    assert sent["end"]["dateTime"] == "2026-09-20T11:00:00+05:00"


def test_generate_meet_does_not_duplicate_existing_event(client, monkeypatch):
    _bypass_access_token(monkeypatch)
    calls = []
    monkeypatch.setattr(
        google_calendar_service.httpx, "post", lambda *a, **k: calls.append(1) or _success_event_response()
    )

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    created = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=headers
    ).json()
    assert len(calls) == 1

    again = client.post(f"/api/v1/schedule/sessions/{created['id']}/generate-meet", headers=headers)
    assert again.status_code == 200, again.text
    assert again.json()["google_event_id"] == created["google_event_id"]
    assert len(calls) == 1  # no second Calendar API call


def test_generate_meet_force_regenerates(client, monkeypatch):
    _bypass_access_token(monkeypatch)
    post_calls = []
    delete_calls = []
    monkeypatch.setattr(
        google_calendar_service.httpx,
        "post",
        lambda *a, **k: post_calls.append(1) or _success_event_response(event_id=f"evt{len(post_calls)}"),
    )
    monkeypatch.setattr(
        google_calendar_service.httpx, "delete", lambda *a, **k: delete_calls.append(1) or FakeGoogleResponse(204)
    )

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    created = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=headers
    ).json()
    assert created["google_event_id"] == "evt1"

    regenerated = client.post(
        f"/api/v1/schedule/sessions/{created['id']}/generate-meet", params={"force": "true"}, headers=headers
    )
    assert regenerated.status_code == 200, regenerated.text
    assert regenerated.json()["google_event_id"] == "evt2"
    assert len(delete_calls) == 1
    assert len(post_calls) == 2


def test_google_api_failure_handled_without_crashing(client, monkeypatch):
    _bypass_access_token(monkeypatch)

    def fake_post(url, params=None, headers=None, json=None, timeout=None):
        return FakeGoogleResponse(500, {"error": {"message": "Internal error"}})

    monkeypatch.setattr(google_calendar_service.httpx, "post", fake_post)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)

    response = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=headers
    )
    assert response.status_code == 201, response.text  # class creation itself never fails
    body = response.json()
    assert body["meeting_status"] == "failed"
    assert body["meet_link"] is None
    assert body["google_event_id"] is None


def test_update_session_updates_google_event_instead_of_creating_new_one(client, monkeypatch):
    _bypass_access_token(monkeypatch)
    post_calls = []
    patch_calls = []
    monkeypatch.setattr(google_calendar_service.httpx, "post", lambda *a, **k: post_calls.append(1) or _success_event_response())
    monkeypatch.setattr(
        google_calendar_service.httpx,
        "patch",
        lambda *a, **k: patch_calls.append(k.get("json")) or _success_event_response(),
    )

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    created = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=headers
    ).json()

    updated = client.patch(
        f"/api/v1/schedule/sessions/{created['id']}", json={"title": "Mathematics Retest"}, headers=headers
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "Mathematics Retest"
    assert updated.json()["google_event_id"] == created["google_event_id"]  # same event, not a new one
    assert len(post_calls) == 1  # only the original creation
    assert len(patch_calls) == 1  # exactly one update call
    assert patch_calls[0]["summary"] == "Mathematics Retest"


def test_delete_session_cancels_google_event(client, monkeypatch):
    _bypass_access_token(monkeypatch)
    delete_calls = []
    monkeypatch.setattr(google_calendar_service.httpx, "post", lambda *a, **k: _success_event_response())
    monkeypatch.setattr(
        google_calendar_service.httpx, "delete", lambda *a, **k: delete_calls.append(1) or FakeGoogleResponse(204)
    )

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    created = client.post(
        "/api/v1/schedule/sessions", json=_online_class_payload(section, subject, teacher), headers=headers
    ).json()

    response = client.delete(f"/api/v1/schedule/sessions/{created['id']}", headers=headers)
    assert response.status_code == 204
    assert len(delete_calls) == 1

    listing = client.get("/api/v1/schedule/sessions", headers=headers).json()
    session = next(s for s in listing if s["id"] == created["id"])
    assert session["status"] == "cancelled"
    assert session["meeting_status"] == "cancelled"
    assert session["google_event_id"] is None


def test_google_credentials_loaded_from_environment(monkeypatch):
    monkeypatch.setattr(google_calendar_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(google_calendar_service.settings, "GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setattr(google_calendar_service.settings, "GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setattr(google_calendar_service.settings, "GOOGLE_REDIRECT_URI", "http://localhost:8000/cb")
    assert google_calendar_service.GoogleCalendarService(None).is_configured() is True

    monkeypatch.setattr(google_calendar_service.settings, "GOOGLE_CLIENT_ID", None)
    assert google_calendar_service.GoogleCalendarService(None).is_configured() is False


def test_non_admin_cannot_manage_google_connection(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _setup(client, headers)
    teacher_headers = _teacher_headers(client)

    assert client.get("/api/v1/integrations/google-calendar/authorize", headers=teacher_headers).status_code == 403
    assert client.get("/api/v1/integrations/google-calendar/status", headers=teacher_headers).status_code == 403
    assert client.delete("/api/v1/integrations/google-calendar/disconnect", headers=teacher_headers).status_code == 403


def test_admin_authorize_without_configuration_returns_conflict(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    response = client.get("/api/v1/integrations/google-calendar/authorize", headers=headers)
    assert response.status_code == 409


def test_google_calendar_status_reports_not_connected_by_default(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    response = client.get("/api/v1/integrations/google-calendar/status", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"connected": False, "google_account_email": None, "calendar_id": None}
