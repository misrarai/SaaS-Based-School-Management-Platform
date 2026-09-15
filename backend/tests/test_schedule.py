from datetime import date, timedelta

from tests.conftest import auth_headers, onboard_and_login_admin

SESSION_DATE = date(2026, 9, 7)


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_section(client, headers, class_id, name="A"):
    response = client.post(f"/api/v1/classes/{class_id}/sections", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_subject(client, headers, class_id, name="Mathematics", code="MATH5"):
    response = client.post(f"/api/v1/classes/{class_id}/subjects", json={"name": name, "code": code}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_teacher(client, headers, email="tom@greenwood.example.com"):
    response = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": email, "password": "Password123!"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_template(client, headers, section_id, subject_id, teacher_id, day_of_week=SESSION_DATE.weekday()):
    response = client.post(
        "/api/v1/schedule/templates",
        json={
            "section_id": section_id,
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "day_of_week": day_of_week,
            "start_time": "09:00:00",
            "end_time": "09:45:00",
            "default_meeting_url": "https://meet.google.com/abc-defg-hij",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _setup(client, headers):
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    return class_grade, section, subject, teacher


def _teacher_headers(client, email="tom@greenwood.example.com"):
    resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": email, "password": "Password123!"},
    )
    assert resp.status_code == 200
    return auth_headers(resp.json())


def test_create_template_and_generate_sessions(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    template = create_template(client, headers, section["id"], subject["id"], teacher["id"])

    response = client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": SESSION_DATE.isoformat(), "end_date": (SESSION_DATE + timedelta(days=6)).isoformat()},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    sessions = response.json()
    assert len(sessions) == 1
    assert sessions[0]["class_schedule_id"] == template["id"]
    assert sessions[0]["meeting_url"] == "https://meet.google.com/abc-defg-hij"
    assert sessions[0]["session_date"] == SESSION_DATE.isoformat()
    assert sessions[0]["status"] == "scheduled"


def test_generate_sessions_is_idempotent(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    create_template(client, headers, section["id"], subject["id"], teacher["id"])

    body = {"start_date": SESSION_DATE.isoformat(), "end_date": SESSION_DATE.isoformat()}
    first = client.post("/api/v1/schedule/sessions/generate", json=body, headers=headers)
    second = client.post("/api/v1/schedule/sessions/generate", json=body, headers=headers)
    assert len(first.json()) == 1
    assert len(second.json()) == 0

    listing = client.get("/api/v1/schedule/sessions", headers=headers)
    assert len(listing.json()) == 1


def test_teacher_starts_and_ends_own_session(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    create_template(client, headers, section["id"], subject["id"], teacher["id"])
    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": SESSION_DATE.isoformat(), "end_date": SESSION_DATE.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    teacher_headers = _teacher_headers(client)

    start_resp = client.post(f"/api/v1/schedule/sessions/{session_id}/start", headers=teacher_headers)
    assert start_resp.status_code == 200
    assert start_resp.json()["status"] == "live"
    assert start_resp.json()["actual_start_at"] is not None

    end_resp = client.post(f"/api/v1/schedule/sessions/{session_id}/end", headers=teacher_headers)
    assert end_resp.status_code == 200
    assert end_resp.json()["status"] == "completed"
    assert end_resp.json()["actual_end_at"] is not None


def test_another_teacher_cannot_start_session_they_do_not_own(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    create_teacher(client, headers, email="other@greenwood.example.com")
    create_template(client, headers, section["id"], subject["id"], teacher["id"])
    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": SESSION_DATE.isoformat(), "end_date": SESSION_DATE.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    other_headers = _teacher_headers(client, email="other@greenwood.example.com")

    response = client.post(f"/api/v1/schedule/sessions/{session_id}/start", headers=other_headers)
    assert response.status_code == 403


def test_teacher_sessions_list_scoped_to_self(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher_a = create_teacher(client, headers, email="a@greenwood.example.com")
    teacher_b = create_teacher(client, headers, email="b@greenwood.example.com")
    create_template(client, headers, section["id"], subject["id"], teacher_a["id"])
    create_template(client, headers, section["id"], subject["id"], teacher_b["id"])
    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": SESSION_DATE.isoformat(), "end_date": SESSION_DATE.isoformat()},
        headers=headers,
    )

    teacher_a_headers = _teacher_headers(client, email="a@greenwood.example.com")
    response = client.get("/api/v1/schedule/sessions", headers=teacher_a_headers)
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 1
    assert sessions[0]["teacher_id"] == teacher_a["id"]


def test_admin_only_can_manage_templates(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)

    teacher_headers = _teacher_headers(client)
    response = client.post(
        "/api/v1/schedule/templates",
        json={
            "section_id": section["id"],
            "subject_id": subject["id"],
            "teacher_id": teacher["id"],
            "day_of_week": SESSION_DATE.weekday(),
            "start_time": "09:00:00",
            "end_time": "09:45:00",
        },
        headers=teacher_headers,
    )
    assert response.status_code == 403


def test_sessions_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    _, section, subject, teacher = _setup(client, headers_a)
    create_template(client, headers_a, section["id"], subject["id"], teacher["id"])
    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": SESSION_DATE.isoformat(), "end_date": SESSION_DATE.isoformat()},
        headers=headers_a,
    )

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/schedule/sessions", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []
