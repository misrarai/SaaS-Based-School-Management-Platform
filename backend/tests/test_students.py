from tests.conftest import auth_headers, onboard_and_login_admin


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


def test_admin_creates_student_in_class_and_section(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])

    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "section_id": section["id"],
            "roll_number": "5A-01",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["class_grade_id"] == class_grade["id"]
    assert body["section_id"] == section["id"]
    assert body["status"] == "active"


def test_student_creation_rejects_section_from_another_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_a = create_class(client, headers, name="Grade 5", level_order=5)
    class_b = create_class(client, headers, name="Grade 6", level_order=6)
    section_of_b = create_section(client, headers, class_b["id"])

    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_a["id"],
            "section_id": section_of_b["id"],
        },
        headers=headers,
    )
    assert response.status_code == 409


def test_list_students_filtered_by_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_a = create_class(client, headers, name="Grade 5", level_order=5)
    class_b = create_class(client, headers, name="Grade 6", level_order=6)

    client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_a["id"],
        },
        headers=headers,
    )
    client.post(
        "/api/v1/students",
        json={
            "full_name": "Alex Student",
            "email": "alex@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_b["id"],
        },
        headers=headers,
    )

    response = client.get(f"/api/v1/students?class_grade_id={class_a['id']}", headers=headers)
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["full_name"] == "Sam Student"


def test_student_can_log_in_and_gets_student_role(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "sam@greenwood.example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    me = client.get("/api/v1/auth/me", headers=auth_headers(login_resp.json()))
    assert me.json()["role"] == "student"


def test_student_can_fetch_own_profile_via_me(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "roll_number": "5A-01",
        },
        headers=headers,
    )
    student = create_resp.json()

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "sam@greenwood.example.com", "password": "Password123!"},
    )
    student_headers = auth_headers(login_resp.json())

    response = client.get("/api/v1/students/me", headers=student_headers)
    assert response.status_code == 200
    assert response.json()["id"] == student["id"]
    assert response.json()["roll_number"] == "5A-01"

    admin_response = client.get("/api/v1/students/me", headers=headers)
    assert admin_response.status_code == 403


def test_student_of_one_school_not_visible_to_another(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    class_a = create_class(client, headers_a)
    student_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_a["id"],
        },
        headers=headers_a,
    )
    student_id = student_resp.json()["id"]

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)

    response = client.get(f"/api/v1/students/{student_id}", headers=headers_b)
    assert response.status_code == 404


def test_admin_can_update_student_name_and_roll(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "roll_number": "01",
        },
        headers=headers,
    )
    student_id = create_resp.json()["id"]

    patch_resp = client.patch(
        f"/api/v1/students/{student_id}",
        json={"full_name": "Samuel Student", "roll_number": "05", "guardian_name": "Ahmad Ali"},
        headers=headers,
    )
    assert patch_resp.status_code == 200, patch_resp.text
    body = patch_resp.json()
    assert body["full_name"] == "Samuel Student"
    assert body["roll_number"] == "05"
    assert body["guardian_name"] == "Ahmad Ali"


def test_admin_can_update_dob_and_admission_date(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )
    student_id = create_resp.json()["id"]

    patch_resp = client.patch(
        f"/api/v1/students/{student_id}",
        json={"date_of_birth": "2012-03-15", "admission_date": "2020-04-01"},
        headers=headers,
    )
    assert patch_resp.status_code == 200, patch_resp.text
    body = patch_resp.json()
    assert body["date_of_birth"] == "2012-03-15"
    assert body["admission_date"] == "2020-04-01"


def test_admin_can_update_admission_detail_via_patch(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )
    student_id = create_resp.json()["id"]

    patch_resp = client.patch(
        f"/api/v1/students/{student_id}",
        json={"admission_detail": {"father_name": "Ahmad Ali", "whatsapp_number": "03001234567"}},
        headers=headers,
    )
    assert patch_resp.status_code == 200, patch_resp.text
    detail = patch_resp.json()["admission_detail"]
    assert detail["father_name"] == "Ahmad Ali"
    assert detail["whatsapp_number"] == "03001234567"


def test_teacher_cannot_patch_student(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )
    student_id = create_resp.json()["id"]

    # Create a teacher
    teacher_resp = client.post(
        "/api/v1/teachers",
        json={
            "full_name": "Jane Teacher",
            "email": "jane@greenwood.example.com",
            "password": "Password123!",
        },
        headers=headers,
    )
    assert teacher_resp.status_code == 201
    teacher_login = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "jane@greenwood.example.com", "password": "Password123!"},
    )
    teacher_headers = auth_headers(teacher_login.json())

    patch_resp = client.patch(f"/api/v1/students/{student_id}", json={"full_name": "Hacked"}, headers=teacher_headers)
    assert patch_resp.status_code == 403


def test_withdraw_and_reactivate_student(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )
    student_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "active"

    withdraw_resp = client.post(
        f"/api/v1/students/{student_id}/withdraw",
        json={"reason": "Transferred to another school"},
        headers=headers,
    )
    assert withdraw_resp.status_code == 200, withdraw_resp.text
    assert withdraw_resp.json()["status"] == "withdrawn"
    assert withdraw_resp.json()["is_active"] is False
    assert withdraw_resp.json()["withdrawal_reason"] == "Transferred to another school"

    reactivate_resp = client.post(f"/api/v1/students/{student_id}/reactivate", headers=headers)
    assert reactivate_resp.status_code == 200, reactivate_resp.text
    assert reactivate_resp.json()["status"] == "active"
    assert reactivate_resp.json()["is_active"] is True


def test_status_filter_old_returns_withdrawn_students(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    s1 = client.post("/api/v1/students", json={"full_name": "Active Student", "email": "active@greenwood.example.com", "password": "Password123!", "class_grade_id": class_grade["id"]}, headers=headers).json()
    s2 = client.post("/api/v1/students", json={"full_name": "Old Student", "email": "old@greenwood.example.com", "password": "Password123!", "class_grade_id": class_grade["id"]}, headers=headers).json()

    client.post(f"/api/v1/students/{s2['id']}/withdraw", json={}, headers=headers)

    active_resp = client.get("/api/v1/students?status=active", headers=headers)
    assert active_resp.status_code == 200
    active_ids = [s["id"] for s in active_resp.json()]
    assert s1["id"] in active_ids
    assert s2["id"] not in active_ids

    old_resp = client.get("/api/v1/students?status=old", headers=headers)
    assert old_resp.status_code == 200
    old_ids = [s["id"] for s in old_resp.json()]
    assert s2["id"] in old_ids
    assert s1["id"] not in old_ids


def test_enrollment_history_created_on_registration(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )
    student_id = create_resp.json()["id"]

    enr_resp = client.get(f"/api/v1/students/{student_id}/enrollments", headers=headers)
    assert enr_resp.status_code == 200, enr_resp.text
    records = enr_resp.json()
    assert len(records) == 1
    assert records[0]["status"] == "active"
    assert records[0]["class_grade_id"] == class_grade["id"]


def test_enrollment_history_updated_on_class_change(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_a = create_class(client, headers, name="Grade 5", level_order=5)
    class_b = create_class(client, headers, name="Grade 6", level_order=6)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_a["id"],
        },
        headers=headers,
    )
    student_id = create_resp.json()["id"]

    # Change class
    patch_resp = client.patch(
        f"/api/v1/students/{student_id}",
        json={"class_grade_id": class_b["id"]},
        headers=headers,
    )
    assert patch_resp.status_code == 200, patch_resp.text
    assert patch_resp.json()["class_grade_id"] == class_b["id"]

    enr_resp = client.get(f"/api/v1/students/{student_id}/enrollments", headers=headers)
    records = enr_resp.json()
    assert len(records) == 2
    statuses = {r["class_grade_id"]: r["status"] for r in records}
    assert statuses[class_a["id"]] == "previous"
    assert statuses[class_b["id"]] == "active"


def test_section_filter_lists_only_correct_students(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    section_a = create_section(client, headers, class_grade["id"], name="A")
    section_b = create_section(client, headers, class_grade["id"], name="B")

    s1 = client.post("/api/v1/students", json={"full_name": "Alice", "email": "alice@greenwood.example.com", "password": "Password123!", "class_grade_id": class_grade["id"], "section_id": section_a["id"]}, headers=headers).json()
    s2 = client.post("/api/v1/students", json={"full_name": "Bob", "email": "bob@greenwood.example.com", "password": "Password123!", "class_grade_id": class_grade["id"], "section_id": section_b["id"]}, headers=headers).json()

    resp = client.get(f"/api/v1/students?class_grade_id={class_grade['id']}&section_id={section_a['id']}", headers=headers)
    assert resp.status_code == 200
    result_ids = [s["id"] for s in resp.json()]
    assert s1["id"] in result_ids
    assert s2["id"] not in result_ids
