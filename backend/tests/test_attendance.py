from datetime import date

from tests.conftest import auth_headers, login, onboard_and_login_admin

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


def create_student(client, headers, class_id, section_id, email="sam@greenwood.example.com", name="Sam Student"):
    response = client.post(
        "/api/v1/students",
        json={
            "full_name": name,
            "email": email,
            "password": "Password123!",
            "class_grade_id": class_id,
            "section_id": section_id,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_template(client, headers, section_id, subject_id, teacher_id):
    response = client.post(
        "/api/v1/schedule/templates",
        json={
            "section_id": section_id,
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "day_of_week": SESSION_DATE.weekday(),
            "start_time": "09:00:00",
            "end_time": "09:45:00",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _setup_session(client, headers):
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    create_template(client, headers, section["id"], subject["id"], teacher["id"])
    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": SESSION_DATE.isoformat(), "end_date": SESSION_DATE.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    return class_grade, section, teacher, session_id


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def test_teacher_marks_attendance_for_roster(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, teacher, session_id = _setup_session(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    t_headers = _login(client, "tom@greenwood.example.com")

    roster_resp = client.get(f"/api/v1/attendance/sessions/{session_id}/roster", headers=t_headers)
    assert roster_resp.status_code == 200
    roster = roster_resp.json()
    assert len(roster) == 1
    assert roster[0]["student_id"] == student["id"]
    assert roster[0]["status"] is None

    mark_resp = client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "present"}]},
        headers=t_headers,
    )
    assert mark_resp.status_code == 200
    assert mark_resp.json()[0]["status"] == "present"

    roster_after = client.get(f"/api/v1/attendance/sessions/{session_id}/roster", headers=t_headers).json()
    assert roster_after[0]["status"] == "present"


def test_marking_attendance_twice_updates_not_duplicates(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, teacher, session_id = _setup_session(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    t_headers = _login(client, "tom@greenwood.example.com")

    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "absent"}]},
        headers=t_headers,
    )
    second = client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "present", "note": "arrived late"}]},
        headers=t_headers,
    )
    assert second.status_code == 200
    assert len(second.json()) == 1
    assert second.json()[0]["status"] == "present"
    assert second.json()[0]["note"] == "arrived late"


def test_other_teacher_cannot_mark_attendance_for_session_they_do_not_own(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, teacher, session_id = _setup_session(client, headers)
    create_student(client, headers, class_grade["id"], section["id"])
    create_teacher(client, headers, email="other@greenwood.example.com")
    other_headers = _login(client, "other@greenwood.example.com")

    response = client.get(f"/api/v1/attendance/sessions/{session_id}/roster", headers=other_headers)
    assert response.status_code == 403


def test_student_monthly_summary(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, teacher, session_id = _setup_session(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    t_headers = _login(client, "tom@greenwood.example.com")
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "present"}]},
        headers=t_headers,
    )

    student_headers = _login(client, "sam@greenwood.example.com")
    response = client.get(
        f"/api/v1/attendance/students/{student['id']}/summary"
        f"?month={SESSION_DATE.month}&year={SESSION_DATE.year}",
        headers=student_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["present"] == 1
    assert body["total"] == 1
    assert body["percentage"] == 100.0


def test_student_cannot_view_another_students_summary(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, teacher, session_id = _setup_session(client, headers)
    create_student(client, headers, class_grade["id"], section["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], section["id"], email="b@greenwood.example.com")

    student_a_headers = _login(client, "a@greenwood.example.com")
    response = client.get(
        f"/api/v1/attendance/students/{student_b['id']}/summary"
        f"?month={SESSION_DATE.month}&year={SESSION_DATE.year}",
        headers=student_a_headers,
    )
    assert response.status_code == 403


def test_parent_can_view_linked_childs_summary_but_not_others(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, teacher, session_id = _setup_session(client, headers)
    student_a = create_student(client, headers, class_grade["id"], section["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], section["id"], email="b@greenwood.example.com")
    t_headers = _login(client, "tom@greenwood.example.com")
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student_a["id"], "status": "present"}]},
        headers=t_headers,
    )

    link_resp = client.post(
        f"/api/v1/students/{student_a['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert link_resp.status_code == 201
    parent_headers = _login(client, "parent@greenwood.example.com")

    ok_resp = client.get(
        f"/api/v1/attendance/students/{student_a['id']}/summary"
        f"?month={SESSION_DATE.month}&year={SESSION_DATE.year}",
        headers=parent_headers,
    )
    assert ok_resp.status_code == 200
    assert ok_resp.json()["present"] == 1

    forbidden_resp = client.get(
        f"/api/v1/attendance/students/{student_b['id']}/summary"
        f"?month={SESSION_DATE.month}&year={SESSION_DATE.year}",
        headers=parent_headers,
    )
    assert forbidden_resp.status_code == 403


def test_admin_analytics(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, teacher, session_id = _setup_session(client, headers)
    student_a = create_student(client, headers, class_grade["id"], section["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], section["id"], email="b@greenwood.example.com")
    t_headers = _login(client, "tom@greenwood.example.com")
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={
            "records": [
                {"student_id": student_a["id"], "status": "present"},
                {"student_id": student_b["id"], "status": "absent"},
            ]
        },
        headers=t_headers,
    )

    response = client.get(f"/api/v1/attendance/analytics?section_id={section['id']}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["present"] == 1
    assert body["absent"] == 1
    assert body["total"] == 2
    assert body["percentage"] == 50.0


def test_analytics_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    class_grade, section, teacher, session_id = _setup_session(client, headers_a)
    student = create_student(client, headers_a, class_grade["id"], section["id"])
    t_headers = _login(client, "tom@greenwood.example.com")
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "present"}]},
        headers=t_headers,
    )

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/attendance/analytics", headers=headers_b)
    assert response.status_code == 200
    assert response.json()["total"] == 0
