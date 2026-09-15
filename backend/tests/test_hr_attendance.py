from datetime import date

from tests.conftest import auth_headers, onboard_and_login_admin


def create_teacher(client, headers, email="tom@greenwood.example.com"):
    response = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": email, "password": "Password123!"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_staff(client, headers, full_name="Sara Staff", designation="Accountant"):
    response = client.post(
        "/api/v1/staff",
        json={"full_name": full_name, "designation": designation},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


# --- Teacher self check-in/out ---


def test_teacher_can_check_in_and_out(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    check_in = client.post("/api/v1/attendance/teachers/check-in", headers=teacher_headers)
    assert check_in.status_code == 201, check_in.text
    body = check_in.json()
    assert body["status"] == "present"
    assert body["check_in_at"] is not None
    assert body["check_out_at"] is None

    today = client.get("/api/v1/attendance/teachers/me/today", headers=teacher_headers)
    assert today.status_code == 200
    assert today.json()["check_in_at"] is not None

    check_out = client.post("/api/v1/attendance/teachers/check-out", headers=teacher_headers)
    assert check_out.status_code == 200, check_out.text
    assert check_out.json()["check_out_at"] is not None


def test_teacher_cannot_check_in_twice(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    client.post("/api/v1/attendance/teachers/check-in", headers=teacher_headers)
    second = client.post("/api/v1/attendance/teachers/check-in", headers=teacher_headers)
    assert second.status_code == 409


def test_teacher_cannot_check_out_without_checking_in(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    response = client.post("/api/v1/attendance/teachers/check-out", headers=teacher_headers)
    assert response.status_code == 409


def test_student_and_parent_cannot_check_in_as_teacher(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)

    class_grade = client.post(
        "/api/v1/classes", json={"name": "Grade 1", "level_order": 1, "academic_year": "2026-2027"}, headers=headers
    ).json()
    student = client.post(
        "/api/v1/students",
        json={"full_name": "Sam Student", "email": "sam@greenwood.example.com", "password": "Password123!", "class_grade_id": class_grade["id"]},
        headers=headers,
    ).json()
    student_headers = _login(client, "sam@greenwood.example.com")

    response = client.post("/api/v1/attendance/teachers/check-in", headers=student_headers)
    assert response.status_code == 403


def test_admin_sees_teacher_attendance_with_name(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")
    client.post("/api/v1/attendance/teachers/check-in", headers=teacher_headers)

    response = client.get("/api/v1/attendance/teachers", headers=headers)
    assert response.status_code == 200, response.text
    records = response.json()
    assert len(records) == 1
    assert records[0]["teacher_name"] == "Tom Teacher"
    assert records[0]["status"] == "present"


def test_admin_can_mark_teacher_absent(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    teacher = create_teacher(client, headers)

    response = client.post(
        "/api/v1/attendance/teachers/mark",
        json={"teacher_id": teacher["id"], "attendance_date": date.today().isoformat(), "status": "absent", "note": "Sick leave"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "absent"

    summary = client.get("/api/v1/attendance/teachers/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["absent"] == 1
    assert summary.json()["total"] == 1


def test_teacher_cannot_mark_own_attendance_as_admin_would(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    teacher = create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    response = client.post(
        "/api/v1/attendance/teachers/mark",
        json={"teacher_id": teacher["id"], "attendance_date": date.today().isoformat(), "status": "present"},
        headers=teacher_headers,
    )
    assert response.status_code == 403


# --- Staff daily register (admin-marked) ---


def test_admin_marks_staff_attendance(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    staff = create_staff(client, headers)

    response = client.post(
        "/api/v1/attendance/staff/mark",
        json={"staff_id": staff["id"], "attendance_date": date.today().isoformat(), "status": "present"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "present"

    listing = client.get("/api/v1/attendance/staff", headers=headers)
    assert listing.status_code == 200
    assert listing.json()[0]["staff_name"] == "Sara Staff"
    assert listing.json()[0]["designation"] == "Accountant"


def test_admin_bulk_marks_staff_daily_register(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    staff_a = create_staff(client, headers, full_name="Sara Staff")
    staff_b = create_staff(client, headers, full_name="Bilal Staff", designation="Guard")

    response = client.post(
        "/api/v1/attendance/staff/bulk-mark",
        json={
            "attendance_date": date.today().isoformat(),
            "records": [
                {"staff_id": staff_a["id"], "status": "present"},
                {"staff_id": staff_b["id"], "status": "late", "note": "Traffic"},
            ],
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert len(response.json()) == 2

    summary = client.get("/api/v1/attendance/staff/summary", headers=headers)
    assert summary.json()["present"] == 1
    assert summary.json()["late"] == 1
    assert summary.json()["total"] == 2


def test_staff_daily_roster_prefills_existing_marks(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    staff = create_staff(client, headers)
    client.post(
        "/api/v1/attendance/staff/mark",
        json={"staff_id": staff["id"], "attendance_date": date.today().isoformat(), "status": "present"},
        headers=headers,
    )

    roster = client.get("/api/v1/attendance/staff/roster", headers=headers)
    assert roster.status_code == 200
    entry = next(e for e in roster.json() if e["staff_id"] == staff["id"])
    assert entry["status"] == "present"
    assert entry["full_name"] == "Sara Staff"


def test_re_marking_staff_attendance_updates_not_duplicates(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    staff = create_staff(client, headers)
    today = date.today().isoformat()

    client.post("/api/v1/attendance/staff/mark", json={"staff_id": staff["id"], "attendance_date": today, "status": "absent"}, headers=headers)
    client.post("/api/v1/attendance/staff/mark", json={"staff_id": staff["id"], "attendance_date": today, "status": "present"}, headers=headers)

    listing = client.get("/api/v1/attendance/staff", headers=headers).json()
    assert len(listing) == 1
    assert listing[0]["status"] == "present"


def test_teacher_cannot_mark_staff_attendance(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    staff = create_staff(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    response = client.post(
        "/api/v1/attendance/staff/mark",
        json={"staff_id": staff["id"], "attendance_date": date.today().isoformat(), "status": "present"},
        headers=teacher_headers,
    )
    assert response.status_code == 403


def test_hr_attendance_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    create_teacher(client, headers_a)
    teacher_headers = _login(client, "tom@greenwood.example.com")
    client.post("/api/v1/attendance/teachers/check-in", headers=teacher_headers)

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/attendance/teachers", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []


# --- Dashboard summary ---


def test_dashboard_summary_admin_only(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    response = client.get("/api/v1/dashboard/summary", headers=teacher_headers)
    assert response.status_code == 403


def test_dashboard_summary_reflects_current_counts_and_attendance(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    create_teacher(client, headers)
    staff = create_staff(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")
    client.post("/api/v1/attendance/teachers/check-in", headers=teacher_headers)
    client.post(
        "/api/v1/attendance/staff/mark",
        json={"staff_id": staff["id"], "attendance_date": date.today().isoformat(), "status": "present"},
        headers=headers,
    )

    response = client.get("/api/v1/dashboard/summary", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_teachers"] == 1
    assert body["total_staff"] == 1
    assert body["teachers_attendance_today"]["present"] == 1
    assert body["teachers_attendance_today"]["total"] == 1
    assert body["staff_attendance_today"]["present"] == 1
    assert len(body["attendance_trend"]) == 7
    assert body["attendance_trend"][-1]["date"] == date.today().isoformat()
    assert "fees_collected_this_month" in body
    assert "online_classes_today" in body
