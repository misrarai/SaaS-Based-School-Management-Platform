from datetime import date

from tests.conftest import auth_headers, onboard_and_login_admin

SESSION_DATE = date.today()


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


def create_student(client, headers, class_id, section_id, email="sam@greenwood.example.com"):
    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": email,
            "password": "Password123!",
            "class_grade_id": class_id,
            "section_id": section_id,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def schedule_teacher(client, headers, section_id, subject_id, teacher_id):
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


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def _setup(client, headers):
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    schedule_teacher(client, headers, section["id"], subject["id"], teacher["id"])
    return class_grade, section, subject, teacher


def test_progress_reflects_attendance_assignments_and_quizzes(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])

    # No activity yet — zeros across the board, no badges achieved.
    baseline = client.get(f"/api/v1/progress/students/{student['id']}", headers=headers)
    assert baseline.status_code == 200
    body = baseline.json()
    assert body["attendance_percent"] == 0.0
    assert body["assignment_completion_percent"] == 0.0
    assert body["quiz_average_percent"] == 0.0
    assert all(not b["achieved"] for b in body["badges"])

    # Mark attendance present for today via a generated session.
    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": SESSION_DATE.isoformat(), "end_date": SESSION_DATE.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "present"}]},
        headers=teacher_headers,
    )

    # Create + submit an assignment.
    assignment = client.post(
        "/api/v1/assignments",
        json={
            "section_id": section["id"],
            "subject_id": subject["id"],
            "title": "Homework 1",
            "due_date": "2099-01-01T23:59:00Z",
            "max_marks": 10,
        },
        headers=teacher_headers,
    ).json()
    client.post(
        f"/api/v1/assignments/{assignment['id']}/submit",
        json={"file_url": "/static/uploads/hw.pdf"},
        headers=student_headers,
    )

    # Create + attempt a quiz, scoring 100%.
    quiz = client.post(
        "/api/v1/quizzes",
        json={
            "section_id": section["id"],
            "subject_id": subject["id"],
            "title": "Quiz 1",
            "questions": [
                {
                    "question_text": "2+2=?",
                    "question_type": "mcq_single",
                    "marks": 1,
                    "options": [{"option_text": "4", "is_correct": True}, {"option_text": "5", "is_correct": False}],
                }
            ],
        },
        headers=teacher_headers,
    ).json()
    take = client.get(f"/api/v1/quizzes/{quiz['id']}/take", headers=student_headers).json()
    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    correct_option = next(o for o in take["questions"][0]["options"] if o["option_text"] == "4")
    client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/submit",
        json={"answers": [{"question_id": take["questions"][0]["id"], "selected_option_id": correct_option["id"]}]},
        headers=student_headers,
    )

    response = client.get(f"/api/v1/progress/students/{student['id']}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["attendance_percent"] == 100.0
    assert body["assignment_completion_percent"] == 100.0
    assert body["quiz_average_percent"] == 100.0
    badge_codes_achieved = {b["code"] for b in body["badges"] if b["achieved"]}
    assert {"attendance_star", "perfect_attendance", "homework_hero", "quiz_ace"} <= badge_codes_achieved


def test_student_can_view_own_progress_but_not_others(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student_a = create_student(client, headers, class_grade["id"], section["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], section["id"], email="b@greenwood.example.com")
    student_a_headers = _login(client, "a@greenwood.example.com")

    own = client.get(f"/api/v1/progress/students/{student_a['id']}", headers=student_a_headers)
    assert own.status_code == 200

    other = client.get(f"/api/v1/progress/students/{student_b['id']}", headers=student_a_headers)
    assert other.status_code == 403
    assert teacher  # sanity


def test_parent_can_view_childs_progress_but_not_others(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student_a = create_student(client, headers, class_grade["id"], section["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], section["id"], email="b@greenwood.example.com")

    client.post(
        f"/api/v1/students/{student_a['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    parent_headers = _login(client, "parent@greenwood.example.com")

    ok = client.get(f"/api/v1/progress/students/{student_a['id']}", headers=parent_headers)
    assert ok.status_code == 200

    forbidden = client.get(f"/api/v1/progress/students/{student_b['id']}", headers=parent_headers)
    assert forbidden.status_code == 403
    assert subject and teacher  # sanity
