from tests.conftest import auth_headers, onboard_and_login_admin

FUTURE_DUE_DATE = "2099-01-01T23:59:00Z"
PAST_DUE_DATE = "2000-01-01T23:59:00Z"


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
            "day_of_week": 0,
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


def create_assignment(client, headers, section_id, subject_id, due_date=FUTURE_DUE_DATE, max_marks=100):
    response = client.post(
        "/api/v1/assignments",
        json={
            "section_id": section_id,
            "subject_id": subject_id,
            "title": "Chapter 3 Homework",
            "description": "Solve all odd-numbered questions.",
            "due_date": due_date,
            "max_marks": max_marks,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_teacher_creates_assignment_for_scheduled_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    assignment = create_assignment(client, teacher_headers, section["id"], subject["id"])
    assert assignment["title"] == "Chapter 3 Homework"
    assert assignment["teacher_id"] == teacher["id"]


def test_teacher_cannot_create_assignment_for_unscheduled_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    response = client.post(
        "/api/v1/assignments",
        json={
            "section_id": section["id"],
            "subject_id": subject["id"],
            "title": "Unauthorized homework",
            "due_date": FUTURE_DUE_DATE,
        },
        headers=teacher_headers,
    )
    assert response.status_code == 403


def test_student_submits_assignment_on_time_and_late(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])

    on_time_assignment = create_assignment(client, teacher_headers, section["id"], subject["id"], due_date=FUTURE_DUE_DATE)
    late_assignment = create_assignment(client, teacher_headers, section["id"], subject["id"], due_date=PAST_DUE_DATE)

    on_time_resp = client.post(
        f"/api/v1/assignments/{on_time_assignment['id']}/submit",
        json={"file_url": "/static/uploads/hw1.pdf"},
        headers=student_headers,
    )
    assert on_time_resp.status_code == 201, on_time_resp.text
    assert on_time_resp.json()["is_late"] is False

    late_resp = client.post(
        f"/api/v1/assignments/{late_assignment['id']}/submit",
        json={"file_url": "/static/uploads/hw2.pdf"},
        headers=student_headers,
    )
    assert late_resp.status_code == 201
    assert late_resp.json()["is_late"] is True


def test_resubmission_updates_not_duplicates(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    assignment = create_assignment(client, teacher_headers, section["id"], subject["id"])

    client.post(
        f"/api/v1/assignments/{assignment['id']}/submit",
        json={"file_url": "/static/uploads/v1.pdf"},
        headers=student_headers,
    )
    second = client.post(
        f"/api/v1/assignments/{assignment['id']}/submit",
        json={"file_url": "/static/uploads/v2.pdf"},
        headers=student_headers,
    )
    assert second.status_code == 201
    assert second.json()["submitted_file_url"] == "/static/uploads/v2.pdf"

    submissions = client.get(f"/api/v1/assignments/{assignment['id']}/submissions", headers=teacher_headers)
    assert len(submissions.json()) == 1


def test_teacher_grades_submission(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    assignment = create_assignment(client, teacher_headers, section["id"], subject["id"], max_marks=50)

    submission = client.post(
        f"/api/v1/assignments/{assignment['id']}/submit",
        json={"file_url": "/static/uploads/hw.pdf"},
        headers=student_headers,
    ).json()

    grade = client.post(
        f"/api/v1/assignments/submissions/{submission['id']}/grade",
        json={"marks_obtained": 42, "teacher_feedback": "Good work"},
        headers=teacher_headers,
    )
    assert grade.status_code == 200
    assert grade.json()["marks_obtained"] == 42
    assert grade.json()["teacher_feedback"] == "Good work"


def test_grade_exceeding_max_marks_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    assignment = create_assignment(client, teacher_headers, section["id"], subject["id"], max_marks=50)

    submission = client.post(
        f"/api/v1/assignments/{assignment['id']}/submit",
        json={"file_url": "/static/uploads/hw.pdf"},
        headers=student_headers,
    ).json()

    response = client.post(
        f"/api/v1/assignments/submissions/{submission['id']}/grade",
        json={"marks_obtained": 75},
        headers=teacher_headers,
    )
    assert response.status_code == 409


def test_gradebook_reflects_graded_submissions_only(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])

    graded_assignment = create_assignment(client, teacher_headers, section["id"], subject["id"], max_marks=100)
    ungraded_assignment = create_assignment(client, teacher_headers, section["id"], subject["id"], max_marks=100)

    graded_submission = client.post(
        f"/api/v1/assignments/{graded_assignment['id']}/submit",
        json={"file_url": "/static/uploads/a.pdf"},
        headers=student_headers,
    ).json()
    client.post(
        f"/api/v1/assignments/{ungraded_assignment['id']}/submit",
        json={"file_url": "/static/uploads/b.pdf"},
        headers=student_headers,
    )
    client.post(
        f"/api/v1/assignments/submissions/{graded_submission['id']}/grade",
        json={"marks_obtained": 88},
        headers=teacher_headers,
    )

    response = client.get("/api/v1/assignments/gradebook", headers=student_headers)
    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 1
    assert entries[0]["assignment_id"] == graded_assignment["id"]
    assert entries[0]["marks_obtained"] == 88


def test_subject_performance_averages_per_subject(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)  # Mathematics
    science = create_subject(client, headers, class_grade["id"], name="Science", code="SCI5")
    schedule_teacher(client, headers, section["id"], science["id"], teacher["id"])
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])

    math_a = create_assignment(client, teacher_headers, section["id"], subject["id"], max_marks=100)
    math_b = create_assignment(client, teacher_headers, section["id"], subject["id"], max_marks=100)
    science_a = create_assignment(client, teacher_headers, section["id"], science["id"], max_marks=50)

    for assignment, marks in [(math_a, 80), (math_b, 90), (science_a, 39)]:
        submission = client.post(
            f"/api/v1/assignments/{assignment['id']}/submit",
            json={"file_url": "/static/uploads/x.pdf"},
            headers=student_headers,
        ).json()
        client.post(
            f"/api/v1/assignments/submissions/{submission['id']}/grade",
            json={"marks_obtained": marks},
            headers=teacher_headers,
        )

    response = client.get("/api/v1/assignments/performance", headers=student_headers)
    assert response.status_code == 200
    by_subject = {row["subject_name"]: row["average_percent"] for row in response.json()}
    assert by_subject == {"Mathematics": 85.0, "Science": 78.0}


def test_parent_can_view_but_not_forge_childs_performance(client):
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
    assert teacher  # sanity

    ok = client.get(f"/api/v1/assignments/performance?student_id={student_a['id']}", headers=parent_headers)
    assert ok.status_code == 200

    forbidden = client.get(f"/api/v1/assignments/performance?student_id={student_b['id']}", headers=parent_headers)
    assert forbidden.status_code == 403

    missing_param = client.get("/api/v1/assignments/performance", headers=parent_headers)
    assert missing_param.status_code == 400


def test_parent_views_childs_gradebook_but_not_others(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student_a = create_student(client, headers, class_grade["id"], section["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], section["id"], email="b@greenwood.example.com")
    teacher_headers = _login(client, teacher["email"])

    client.post(
        f"/api/v1/students/{student_a['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    parent_headers = _login(client, "parent@greenwood.example.com")

    ok = client.get(f"/api/v1/assignments/gradebook?student_id={student_a['id']}", headers=parent_headers)
    assert ok.status_code == 200

    forbidden = client.get(f"/api/v1/assignments/gradebook?student_id={student_b['id']}", headers=parent_headers)
    assert forbidden.status_code == 403
    assert teacher_headers  # sanity


def test_student_sees_only_own_section_assignments(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    section_a = create_section(client, headers, class_grade["id"], name="A")
    section_b = create_section(client, headers, class_grade["id"], name="B")
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    schedule_teacher(client, headers, section_a["id"], subject["id"], teacher["id"])
    schedule_teacher(client, headers, section_b["id"], subject["id"], teacher["id"])
    teacher_headers = _login(client, teacher["email"])

    create_assignment(client, teacher_headers, section_a["id"], subject["id"])
    create_assignment(client, teacher_headers, section_b["id"], subject["id"])

    student = create_student(client, headers, class_grade["id"], section_a["id"])
    student_headers = _login(client, student["email"])

    response = client.get("/api/v1/assignments", headers=student_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_assignments_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    _, section, subject, teacher = _setup(client, headers_a)
    teacher_headers = _login(client, teacher["email"])
    create_assignment(client, teacher_headers, section["id"], subject["id"])

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/assignments", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []
