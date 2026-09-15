from tests.conftest import auth_headers, onboard_and_login_admin


def create_academic_year(client, headers, name="2026", start="2026-01-01", end="2026-12-31", is_active=False):
    response = client.post(
        "/api/v1/academic-years",
        json={"name": name, "start_date": start, "end_date": end, "is_active": is_active},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_class(client, headers, academic_year_id, name="Class 9", level_order=9):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year_id": academic_year_id},
        headers=headers,
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


def create_teacher(client, headers, email="ali@greenwood.example.com", full_name="Ali Ahmed"):
    response = client.post(
        "/api/v1/teachers", json={"full_name": full_name, "email": email, "password": "Password123!"}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_student(client, headers, class_id, section_id, email="sam@greenwood.example.com", full_name="Sam Student"):
    response = client.post(
        "/api/v1/students",
        json={
            "full_name": full_name,
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
    """Assignments still authorize via class_schedules, not Course/TeacherAssignment (see
    AssignmentService._assert_teacher_teaches) — tests that create assignments need both."""
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


def create_course(client, headers, academic_year_id, section_id, subject_id):
    response = client.post(
        "/api/v1/courses",
        json={"academic_year_id": academic_year_id, "section_id": section_id, "subject_id": subject_id},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def _full_hierarchy(client, headers, n_students=3):
    year = create_academic_year(client, headers)
    class_grade = create_class(client, headers, year["id"])
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    students = [
        create_student(client, headers, class_grade["id"], section["id"], email=f"s{i}@greenwood.example.com", full_name=f"Student {i}")
        for i in range(n_students)
    ]
    return year, class_grade, section, subject, students


# --- Academic years -------------------------------------------------


def test_create_and_list_academic_years(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_academic_year(client, headers, name="2026")

    response = client.get("/api/v1/academic-years", headers=headers)
    assert response.status_code == 200
    assert [y["name"] for y in response.json()] == ["2026"]


def test_duplicate_academic_year_name_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_academic_year(client, headers, name="2026")

    response = client.post(
        "/api/v1/academic-years",
        json={"name": "2026", "start_date": "2026-01-01", "end_date": "2026-12-31"},
        headers=headers,
    )
    assert response.status_code == 409


def test_activating_a_year_deactivates_the_others(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year_a = create_academic_year(client, headers, name="2025", is_active=True)
    year_b = create_academic_year(client, headers, name="2026", is_active=True)

    listing = {y["id"]: y["is_active"] for y in client.get("/api/v1/academic-years", headers=headers).json()}
    assert listing[year_a["id"]] is False
    assert listing[year_b["id"]] is True


# --- Class grade / academic year linkage -------------------------------------------------


def test_class_grade_links_to_academic_year(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year = create_academic_year(client, headers, name="2026")
    class_grade = create_class(client, headers, year["id"])

    assert class_grade["academic_year_id"] == year["id"]
    assert class_grade["academic_year"] == "2026"


def test_class_grade_free_text_academic_year_still_works(client):
    """Backward compatibility: every existing caller of POST /classes across the app passes a
    plain academic_year string with no academic_year_id at all."""
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    response = client.post(
        "/api/v1/classes",
        json={"name": "Grade 5", "level_order": 5, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["academic_year"] == "2026-2027"
    assert response.json()["academic_year_id"] is None


# --- Course creation + auto-enrollment -------------------------------------------------


def test_course_creation_auto_enrolls_current_section_students(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, students = _full_hierarchy(client, headers, n_students=3)

    course = create_course(client, headers, year["id"], section["id"], subject["id"])
    assert course["academic_year_name"] == "2026"
    assert course["class_grade_name"] == "Class 9"
    assert course["section_name"] == "A"
    assert course["subject_name"] == "Mathematics"
    assert course["student_count"] == 3
    assert course["teachers"] == []


def test_duplicate_course_for_same_offering_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, _ = _full_hierarchy(client, headers, n_students=0)
    create_course(client, headers, year["id"], section["id"], subject["id"])

    response = client.post(
        "/api/v1/courses",
        json={"academic_year_id": year["id"], "section_id": section["id"], "subject_id": subject["id"]},
        headers=headers,
    )
    assert response.status_code == 409


def test_course_rejects_subject_from_a_different_grade(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year = create_academic_year(client, headers)
    class_grade = create_class(client, headers, year["id"])
    other_grade = create_class(client, headers, year["id"], name="Class 10", level_order=10)
    section = create_section(client, headers, class_grade["id"])
    other_subject = create_subject(client, headers, other_grade["id"])

    response = client.post(
        "/api/v1/courses",
        json={"academic_year_id": year["id"], "section_id": section["id"], "subject_id": other_subject["id"]},
        headers=headers,
    )
    assert response.status_code == 409


# --- Teacher assignment -------------------------------------------------


def test_assign_and_unassign_teacher(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, _ = _full_hierarchy(client, headers, n_students=0)
    course = create_course(client, headers, year["id"], section["id"], subject["id"])
    teacher = create_teacher(client, headers)

    assign = client.post(f"/api/v1/courses/{course['id']}/teachers", json={"teacher_id": teacher["id"]}, headers=headers)
    assert assign.status_code == 201, assign.text
    assert assign.json()["full_name"] == "Ali Ahmed"

    detail = client.get(f"/api/v1/courses/{course['id']}", headers=headers).json()
    assert [t["teacher_id"] for t in detail["teachers"]] == [teacher["id"]]

    duplicate = client.post(f"/api/v1/courses/{course['id']}/teachers", json={"teacher_id": teacher["id"]}, headers=headers)
    assert duplicate.status_code == 409

    unassign = client.delete(f"/api/v1/courses/{course['id']}/teachers/{teacher['id']}", headers=headers)
    assert unassign.status_code == 204

    after = client.get(f"/api/v1/courses/{course['id']}", headers=headers).json()
    assert after["teachers"] == []

    # Reassigning after removal must not violate the (course, teacher) uniqueness constraint.
    reassign = client.post(f"/api/v1/courses/{course['id']}/teachers", json={"teacher_id": teacher["id"]}, headers=headers)
    assert reassign.status_code == 201


def test_teacher_sees_only_assigned_courses(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, _ = _full_hierarchy(client, headers, n_students=0)
    other_subject = create_subject(client, headers, class_grade["id"], name="Science", code="SCI9")
    course_a = create_course(client, headers, year["id"], section["id"], subject["id"])
    create_course(client, headers, year["id"], section["id"], other_subject["id"])
    teacher = create_teacher(client, headers)
    client.post(f"/api/v1/courses/{course_a['id']}/teachers", json={"teacher_id": teacher["id"]}, headers=headers)

    teacher_headers = _login(client, teacher["email"])
    response = client.get("/api/v1/courses", headers=teacher_headers)
    assert response.status_code == 200
    assert [c["id"] for c in response.json()] == [course_a["id"]]


def test_teacher_cannot_view_unassigned_course_detail(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, _ = _full_hierarchy(client, headers, n_students=0)
    course = create_course(client, headers, year["id"], section["id"], subject["id"])
    teacher = create_teacher(client, headers)  # never assigned

    teacher_headers = _login(client, teacher["email"])
    response = client.get(f"/api/v1/courses/{course['id']}", headers=teacher_headers)
    assert response.status_code == 403


# --- Student enrollment -------------------------------------------------


def test_student_sees_only_enrolled_courses(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, students = _full_hierarchy(client, headers, n_students=1)
    other_section = create_section(client, headers, class_grade["id"], name="B")
    course_a = create_course(client, headers, year["id"], section["id"], subject["id"])
    create_course(client, headers, year["id"], other_section["id"], subject["id"])

    student_headers = _login(client, students[0]["email"])
    response = client.get("/api/v1/courses", headers=student_headers)
    assert response.status_code == 200
    assert [c["id"] for c in response.json()] == [course_a["id"]]


def test_drop_and_reenroll_student(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, students = _full_hierarchy(client, headers, n_students=2)
    course = create_course(client, headers, year["id"], section["id"], subject["id"])
    student = students[0]

    drop = client.delete(f"/api/v1/courses/{course['id']}/students/{student['id']}", headers=headers)
    assert drop.status_code == 204

    detail = client.get(f"/api/v1/courses/{course['id']}", headers=headers).json()
    assert detail["student_count"] == 1

    reenroll = client.post(f"/api/v1/courses/{course['id']}/students", json={"student_id": student["id"]}, headers=headers)
    assert reenroll.status_code == 201

    detail_after = client.get(f"/api/v1/courses/{course['id']}", headers=headers).json()
    assert detail_after["student_count"] == 2


def test_enroll_student_not_in_section_for_elective(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, _ = _full_hierarchy(client, headers, n_students=0)
    other_section = create_section(client, headers, class_grade["id"], name="B")
    elective_student = create_student(client, headers, class_grade["id"], other_section["id"], email="elective@greenwood.example.com")
    course = create_course(client, headers, year["id"], section["id"], subject["id"])

    response = client.post(
        f"/api/v1/courses/{course['id']}/students", json={"student_id": elective_student["id"]}, headers=headers
    )
    assert response.status_code == 201
    assert response.json()["student_id"] == elective_student["id"]


def test_parent_sees_only_own_childs_courses(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, students = _full_hierarchy(client, headers, n_students=2)
    course = create_course(client, headers, year["id"], section["id"], subject["id"])

    client.post(
        f"/api/v1/students/{students[0]['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    parent_headers = _login(client, "parent@greenwood.example.com")

    ok = client.get(f"/api/v1/courses?student_id={students[0]['id']}", headers=parent_headers)
    assert ok.status_code == 200
    assert [c["id"] for c in ok.json()] == [course["id"]]

    forbidden = client.get(f"/api/v1/courses?student_id={students[1]['id']}", headers=parent_headers)
    assert forbidden.status_code == 403


# --- My Students (teacher roster) -------------------------------------------------


def test_teacher_students_deduped_across_courses(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, students = _full_hierarchy(client, headers, n_students=2)
    other_subject = create_subject(client, headers, class_grade["id"], name="Science", code="SCI9")
    course_a = create_course(client, headers, year["id"], section["id"], subject["id"])
    course_b = create_course(client, headers, year["id"], section["id"], other_subject["id"])
    teacher = create_teacher(client, headers)
    client.post(f"/api/v1/courses/{course_a['id']}/teachers", json={"teacher_id": teacher["id"]}, headers=headers)
    client.post(f"/api/v1/courses/{course_b['id']}/teachers", json={"teacher_id": teacher["id"]}, headers=headers)

    teacher_headers = _login(client, teacher["email"])
    response = client.get("/api/v1/courses/students/mine", headers=teacher_headers)
    assert response.status_code == 200
    roster = response.json()
    assert len(roster) == 2  # deduped, not 4
    assert sorted(roster[0]["subjects"]) == ["Mathematics", "Science"]


def test_student_and_admin_cannot_read_teacher_roster(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, _, _, _, students = _full_hierarchy(client, headers, n_students=1)
    student_headers = _login(client, students[0]["email"])

    assert client.get("/api/v1/courses/students/mine", headers=student_headers).status_code == 403
    assert client.get("/api/v1/courses/students/mine", headers=headers).status_code == 403


# --- Course gradebook -------------------------------------------------


def test_course_gradebook_reflects_graded_assignments_for_that_subject_only(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, students = _full_hierarchy(client, headers, n_students=1)
    course = create_course(client, headers, year["id"], section["id"], subject["id"])
    teacher = create_teacher(client, headers)
    client.post(f"/api/v1/courses/{course['id']}/teachers", json={"teacher_id": teacher["id"]}, headers=headers)
    schedule_teacher(client, headers, section["id"], subject["id"], teacher["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, students[0]["email"])

    assignment = client.post(
        "/api/v1/assignments",
        json={
            "section_id": section["id"],
            "subject_id": subject["id"],
            "title": "Quiz Review",
            "due_date": "2099-01-01T23:59:00Z",
            "max_marks": 50,
        },
        headers=teacher_headers,
    ).json()
    submission = client.post(
        f"/api/v1/assignments/{assignment['id']}/submit",
        json={"file_url": "/static/uploads/hw.pdf"},
        headers=student_headers,
    ).json()
    client.post(
        f"/api/v1/assignments/submissions/{submission['id']}/grade",
        json={"marks_obtained": 40},
        headers=teacher_headers,
    )

    response = client.get(f"/api/v1/courses/{course['id']}/gradebook", headers=teacher_headers)
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["student_id"] == students[0]["id"]
    assert rows[0]["assignments_graded"] == 1
    assert rows[0]["average_percent"] == 80.0


def test_unassigned_teacher_cannot_view_course_gradebook(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year, class_grade, section, subject, _ = _full_hierarchy(client, headers, n_students=0)
    course = create_course(client, headers, year["id"], section["id"], subject["id"])
    teacher = create_teacher(client, headers)  # never assigned

    teacher_headers = _login(client, teacher["email"])
    response = client.get(f"/api/v1/courses/{course['id']}/gradebook", headers=teacher_headers)
    assert response.status_code == 403


# --- Tenancy -------------------------------------------------


def test_courses_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    year, class_grade, section, subject, _ = _full_hierarchy(client, headers_a, n_students=0)
    create_course(client, headers_a, year["id"], section["id"], subject["id"])

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/courses", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []
