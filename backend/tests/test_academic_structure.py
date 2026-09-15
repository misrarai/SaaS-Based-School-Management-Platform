from tests.conftest import auth_headers, onboard_and_login_admin


def create_class(client, headers, name="Grade 5", level_order=5, academic_year="2026-2027"):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": academic_year},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_create_and_list_classes(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    create_class(client, headers, name="Grade 5", level_order=5)
    create_class(client, headers, name="Grade 1", level_order=1)

    response = client.get("/api/v1/classes", headers=headers)
    assert response.status_code == 200
    names_in_order = [c["name"] for c in response.json()]
    assert names_in_order == ["Grade 1", "Grade 5"]  # ordered by level_order


def test_duplicate_class_name_and_year_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_class(client, headers, name="Grade 5", level_order=5, academic_year="2026-2027")

    response = client.post(
        "/api/v1/classes",
        json={"name": "Grade 5", "level_order": 5, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 409


def test_create_section_and_subject_under_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    section_resp = client.post(
        f"/api/v1/classes/{class_grade['id']}/sections", json={"name": "A"}, headers=headers
    )
    assert section_resp.status_code == 201
    assert section_resp.json()["class_grade_id"] == class_grade["id"]

    subject_resp = client.post(
        f"/api/v1/classes/{class_grade['id']}/subjects",
        json={"name": "Mathematics", "code": "MATH5"},
        headers=headers,
    )
    assert subject_resp.status_code == 201

    sections = client.get(f"/api/v1/classes/{class_grade['id']}/sections", headers=headers)
    assert len(sections.json()) == 1

    subjects = client.get(f"/api/v1/classes/{class_grade['id']}/subjects", headers=headers)
    assert len(subjects.json()) == 1


def test_section_for_nonexistent_class_returns_404(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.post(
        "/api/v1/classes/00000000-0000-0000-0000-000000000000/sections",
        json={"name": "A"},
        headers=headers,
    )
    assert response.status_code == 404


def test_non_admin_role_cannot_manage_classes(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    # Create a teacher, then try to use their token to create a class (should be forbidden).
    teacher_resp = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert teacher_resp.status_code == 201

    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "tom@greenwood.example.com", "password": "Password123!"},
    )
    teacher_headers = auth_headers(teacher_login.json())

    response = client.post(
        "/api/v1/classes",
        json={"name": "Grade 9", "level_order": 9, "academic_year": "2026-2027"},
        headers=teacher_headers,
    )
    assert response.status_code == 403
    assert class_grade  # sanity, avoid unused warning


def test_teacher_can_read_but_not_write_academic_structure(client):
    """Teachers need to browse the catalog to populate class/section/subject pickers when
    creating assignments, resources and quizzes — read access is TEACHER-allowed, writes stay
    ADMIN-only."""
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    section = client.post(f"/api/v1/classes/{class_grade['id']}/sections", json={"name": "A"}, headers=headers).json()
    client.post(f"/api/v1/classes/{class_grade['id']}/subjects", json={"name": "Mathematics", "code": "MATH5"}, headers=headers)

    teacher_resp = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "tom@greenwood.example.com", "password": "Password123!"},
    )
    teacher_headers = auth_headers(teacher_login.json())
    assert teacher_resp.status_code == 201

    assert client.get("/api/v1/classes", headers=teacher_headers).status_code == 200
    assert client.get(f"/api/v1/classes/{class_grade['id']}/sections", headers=teacher_headers).status_code == 200
    assert client.get(f"/api/v1/classes/{class_grade['id']}/subjects", headers=teacher_headers).status_code == 200

    assert client.post(
        f"/api/v1/classes/{class_grade['id']}/sections", json={"name": "B"}, headers=teacher_headers
    ).status_code == 403
    assert section  # sanity, avoid unused warning


def create_academic_year(client, headers, name, start_date, end_date):
    response = client.post(
        "/api/v1/academic-years",
        json={"name": name, "start_date": start_date, "end_date": end_date},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_class_in_year(client, headers, name, level_order, academic_year_id):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year_id": academic_year_id},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_student(client, headers, class_grade_id, section_id=None, email="sam@greenwood.example.com"):
    payload = {
        "full_name": "Sam Student",
        "email": email,
        "password": "Password123!",
        "class_grade_id": class_grade_id,
        "section_id": section_id,
    }
    response = client.post("/api/v1/students", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_promote_students_moves_to_next_level_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year_a = create_academic_year(client, headers, "2025-2026", "2025-08-01", "2026-06-30")
    year_b = create_academic_year(client, headers, "2026-2027", "2026-08-01", "2027-06-30")
    grade5 = create_class_in_year(client, headers, "Grade 5", 5, year_a["id"])
    grade6 = create_class_in_year(client, headers, "Grade 6", 6, year_b["id"])
    student = create_student(client, headers, grade5["id"])

    response = client.post(
        "/api/v1/academic-years/promote",
        json={"from_academic_year_id": year_a["id"], "to_academic_year_id": year_b["id"]},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["students_promoted"] == 1
    assert body["students_graduated"] == 0
    assert body["promoted_by_class"] == [{"class_name": "Grade 5", "students_moved": 1}]

    updated = client.get(f"/api/v1/students/{student['id']}", headers=headers).json()
    assert updated["class_grade_id"] == grade6["id"]
    assert updated["status"] == "active"


def test_promote_without_target_class_graduates_students(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year_a = create_academic_year(client, headers, "2025-2026", "2025-08-01", "2026-06-30")
    year_b = create_academic_year(client, headers, "2026-2027", "2026-08-01", "2027-06-30")
    grade10 = create_class_in_year(client, headers, "Grade 10", 10, year_a["id"])
    student = create_student(client, headers, grade10["id"])

    response = client.post(
        "/api/v1/academic-years/promote",
        json={"from_academic_year_id": year_a["id"], "to_academic_year_id": year_b["id"]},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["students_promoted"] == 0
    assert body["students_graduated"] == 1
    assert body["graduated_classes"] == ["Grade 10"]

    updated = client.get(f"/api/v1/students/{student['id']}", headers=headers).json()
    assert updated["status"] == "graduated"


def test_promote_preserves_matching_section_name(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year_a = create_academic_year(client, headers, "2025-2026", "2025-08-01", "2026-06-30")
    year_b = create_academic_year(client, headers, "2026-2027", "2026-08-01", "2027-06-30")
    grade5 = create_class_in_year(client, headers, "Grade 5", 5, year_a["id"])
    grade6 = create_class_in_year(client, headers, "Grade 6", 6, year_b["id"])
    section_a_old = client.post(f"/api/v1/classes/{grade5['id']}/sections", json={"name": "A"}, headers=headers).json()
    section_a_new = client.post(f"/api/v1/classes/{grade6['id']}/sections", json={"name": "A"}, headers=headers).json()
    student = create_student(client, headers, grade5["id"], section_id=section_a_old["id"])

    client.post(
        "/api/v1/academic-years/promote",
        json={"from_academic_year_id": year_a["id"], "to_academic_year_id": year_b["id"]},
        headers=headers,
    )

    updated = client.get(f"/api/v1/students/{student['id']}", headers=headers).json()
    assert updated["section_id"] == section_a_new["id"]


def test_non_admin_cannot_promote_students(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    year_a = create_academic_year(client, headers, "2025-2026", "2025-08-01", "2026-06-30")
    year_b = create_academic_year(client, headers, "2026-2027", "2026-08-01", "2027-06-30")

    teacher_resp = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert teacher_resp.status_code == 201
    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "tom@greenwood.example.com", "password": "Password123!"},
    )
    teacher_headers = auth_headers(teacher_login.json())

    response = client.post(
        "/api/v1/academic-years/promote",
        json={"from_academic_year_id": year_a["id"], "to_academic_year_id": year_b["id"]},
        headers=teacher_headers,
    )
    assert response.status_code == 403
