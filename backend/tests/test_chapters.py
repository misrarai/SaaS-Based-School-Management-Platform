from tests.conftest import auth_headers, onboard_and_login_admin


def create_academic_year(client, headers, name="2026"):
    response = client.post(
        "/api/v1/academic-years",
        json={"name": name, "start_date": "2026-01-01", "end_date": "2026-12-31", "is_active": True},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_class(client, headers, academic_year_id, name="Class 9", level_order=9):
    response = client.post(
        "/api/v1/classes", json={"name": name, "level_order": level_order, "academic_year_id": academic_year_id}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_section(client, headers, class_id, name="A"):
    response = client.post(f"/api/v1/classes/{class_id}/sections", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def create_subject(client, headers, class_id, name="Mathematics", code="MATH9"):
    response = client.post(f"/api/v1/classes/{class_id}/subjects", json={"name": name, "code": code}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def create_teacher(client, headers, email="ali@greenwood.example.com"):
    response = client.post(
        "/api/v1/teachers", json={"full_name": "Ali Ahmed", "email": email, "password": "Password123!"}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_student(client, headers, class_id, section_id, email="sam@greenwood.example.com"):
    response = client.post(
        "/api/v1/students",
        json={"full_name": "Sam Student", "email": email, "password": "Password123!", "class_grade_id": class_id, "section_id": section_id},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_course(client, headers, academic_year_id, section_id, subject_id):
    response = client.post(
        "/api/v1/courses", json={"academic_year_id": academic_year_id, "section_id": section_id, "subject_id": subject_id}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def schedule_teacher(client, headers, section_id, subject_id, teacher_id):
    response = client.post(
        "/api/v1/schedule/templates",
        json={"section_id": section_id, "subject_id": subject_id, "teacher_id": teacher_id, "day_of_week": 0, "start_time": "09:00:00", "end_time": "09:45:00"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_chapter(client, headers, course_id, title="Chapter 1", order_index=1):
    response = client.post(f"/api/v1/courses/{course_id}/chapters", json={"title": title, "order_index": order_index}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def _setup(client, headers, n_students=1):
    year = create_academic_year(client, headers)
    class_grade = create_class(client, headers, year["id"])
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    students = [create_student(client, headers, class_grade["id"], section["id"], email=f"s{i}@greenwood.example.com") for i in range(n_students)]
    course = create_course(client, headers, year["id"], section["id"], subject["id"])
    client.post(f"/api/v1/courses/{course['id']}/teachers", json={"teacher_id": teacher["id"]}, headers=headers)
    schedule_teacher(client, headers, section["id"], subject["id"], teacher["id"])
    return course, teacher, students, section, subject


def test_admin_creates_chapters_in_order(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    course, *_ = _setup(client, headers, n_students=0)

    create_chapter(client, headers, course["id"], title="Chapter 2", order_index=2)
    create_chapter(client, headers, course["id"], title="Chapter 1", order_index=1)

    listing = client.get(f"/api/v1/courses/{course['id']}/chapters", headers=headers)
    assert listing.status_code == 200
    assert [c["title"] for c in listing.json()] == ["Chapter 1", "Chapter 2"]


def test_duplicate_chapter_title_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    course, *_ = _setup(client, headers, n_students=0)
    create_chapter(client, headers, course["id"], title="Chapter 1")

    response = client.post(f"/api/v1/courses/{course['id']}/chapters", json={"title": "Chapter 1"}, headers=headers)
    assert response.status_code == 409


def test_assigned_teacher_can_manage_chapters(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    course, teacher, *_ = _setup(client, headers, n_students=0)
    teacher_headers = _login(client, teacher["email"])

    chapter = create_chapter(client, teacher_headers, course["id"], title="Chapter 1")
    updated = client.patch(f"/api/v1/courses/{course['id']}/chapters/{chapter['id']}", json={"title": "Algebra Basics"}, headers=teacher_headers)
    assert updated.status_code == 200
    assert updated.json()["title"] == "Algebra Basics"

    deleted = client.delete(f"/api/v1/courses/{course['id']}/chapters/{chapter['id']}", headers=teacher_headers)
    assert deleted.status_code == 204


def test_unassigned_teacher_cannot_manage_chapters(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    course, *_ = _setup(client, headers, n_students=0)
    other_teacher = create_teacher(client, headers, email="other@greenwood.example.com")
    other_headers = _login(client, "other@greenwood.example.com")

    response = client.post(f"/api/v1/courses/{course['id']}/chapters", json={"title": "Chapter 1"}, headers=other_headers)
    assert response.status_code == 403
    assert other_teacher


def test_chapter_content_bundles_resources_and_quiz(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    course, teacher, students, section, subject = _setup(client, headers, n_students=1)
    teacher_headers = _login(client, teacher["email"])
    chapter = create_chapter(client, teacher_headers, course["id"], title="Chapter 1")

    client.post(
        "/api/v1/resources",
        json={
            "title": "Intro video",
            "resource_type": "video",
            "external_url": "https://example.com/video.mp4",
            "chapter_id": chapter["id"],
        },
        headers=teacher_headers,
    )
    client.post(
        "/api/v1/resources",
        json={"title": "Chapter notes", "resource_type": "notes", "file_url": "/static/uploads/notes.pdf", "chapter_id": chapter["id"]},
        headers=teacher_headers,
    )
    client.post(
        "/api/v1/resources",
        json={"title": "Worksheet 1", "resource_type": "worksheet", "file_url": "/static/uploads/ws1.pdf", "chapter_id": chapter["id"]},
        headers=teacher_headers,
    )
    quiz_payload = {
        "section_id": section["id"],
        "subject_id": subject["id"],
        "chapter_id": chapter["id"],
        "title": "Chapter 1 Quiz",
        "questions": [
            {
                "question_text": "2+2=?",
                "question_type": "mcq_single",
                "options": [{"option_text": "4", "is_correct": True}, {"option_text": "5", "is_correct": False}],
            }
        ],
    }
    quiz_resp = client.post("/api/v1/quizzes", json=quiz_payload, headers=teacher_headers)
    assert quiz_resp.status_code == 201, quiz_resp.text

    content = client.get(f"/api/v1/courses/{course['id']}/chapters/{chapter['id']}", headers=teacher_headers)
    assert content.status_code == 200
    body = content.json()
    assert body["chapter"]["title"] == "Chapter 1"
    assert {r["resource_type"] for r in body["resources"]} == {"video", "notes", "worksheet"}
    assert len(body["quizzes"]) == 1
    assert body["quizzes"][0]["title"] == "Chapter 1 Quiz"

    # Enrolled student sees the same bundle.
    student_headers = _login(client, students[0]["email"])
    student_view = client.get(f"/api/v1/courses/{course['id']}/chapters/{chapter['id']}", headers=student_headers)
    assert student_view.status_code == 200
    assert len(student_view.json()["resources"]) == 3


def test_student_not_enrolled_cannot_view_chapters(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    course, teacher, _, section, subject = _setup(client, headers, n_students=0)
    other_class = create_class(client, headers, create_academic_year(client, headers, name="2027")["id"], name="Class 10", level_order=10)
    other_section = create_section(client, headers, other_class["id"])
    outsider = create_student(client, headers, other_class["id"], other_section["id"], email="outsider@greenwood.example.com")
    chapter = create_chapter(client, headers, course["id"])

    outsider_headers = _login(client, outsider["email"])
    response = client.get(f"/api/v1/courses/{course['id']}/chapters", headers=outsider_headers)
    assert response.status_code == 403
    detail = client.get(f"/api/v1/courses/{course['id']}/chapters/{chapter['id']}", headers=outsider_headers)
    assert detail.status_code == 403
    assert teacher and subject  # sanity


def test_chapter_from_wrong_course_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    course_a, _, _, section_a, _ = _setup(client, headers, n_students=0)
    year_b = create_academic_year(client, headers, name="2027")
    class_b = create_class(client, headers, year_b["id"], name="Class 10", level_order=10)
    section_b = create_section(client, headers, class_b["id"])
    subject_b = create_subject(client, headers, class_b["id"], name="Science", code="SCI10")
    course_b = create_course(client, headers, year_b["id"], section_b["id"], subject_b["id"])
    chapter_b = create_chapter(client, headers, course_b["id"])

    response = client.get(f"/api/v1/courses/{course_a['id']}/chapters/{chapter_b['id']}", headers=headers)
    assert response.status_code == 403
    assert section_a
