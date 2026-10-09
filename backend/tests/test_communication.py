from tests.conftest import auth_headers, login, onboard_and_login_admin

BASE = "/api/v1/communication"
PW = "Password123!"


def _setup(client):
    """Admin + teacher + 2 classes (Grade 5 with sections A/B), student in 5-A with linked parent,
    and a second student in Grade 6."""
    admin = auth_headers(onboard_and_login_admin(client))
    g5 = client.post("/api/v1/classes", json={"name": "Grade 5", "level_order": 5, "academic_year": "2026"}, headers=admin).json()
    g6 = client.post("/api/v1/classes", json={"name": "Grade 6", "level_order": 6, "academic_year": "2026"}, headers=admin).json()
    sec_a = client.post(f"/api/v1/classes/{g5['id']}/sections", json={"name": "A"}, headers=admin).json()
    sec_b = client.post(f"/api/v1/classes/{g5['id']}/sections", json={"name": "B"}, headers=admin).json()
    subj = client.post(f"/api/v1/classes/{g5['id']}/subjects", json={"name": "English", "code": "ENG5"}, headers=admin).json()

    r = client.post(
        "/api/v1/students",
        json={"full_name": "Sam Student", "email": "sam@greenwood.example.com", "password": PW,
              "class_grade_id": g5["id"], "section_id": sec_a["id"]},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    student = r.json()
    client.post(
        "/api/v1/students",
        json={"full_name": "Other Kid", "email": "other@greenwood.example.com", "password": PW, "class_grade_id": g6["id"]},
        headers=admin,
    )
    r = client.post(
        f"/api/v1/students/{student['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": PW, "phone_number": "03001112233"},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    client.post("/api/v1/teachers", json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": PW}, headers=admin)

    return {
        "admin": admin,
        "teacher": auth_headers(login(client, "greenwood", "tom@greenwood.example.com", PW)),
        "student": auth_headers(login(client, "greenwood", "sam@greenwood.example.com", PW)),
        "other_student": auth_headers(login(client, "greenwood", "other@greenwood.example.com", PW)),
        "parent": auth_headers(login(client, "greenwood", "parent@greenwood.example.com", PW)),
        "g5": g5, "g6": g6, "sec_a": sec_a, "sec_b": sec_b, "subj": subj, "student_obj": student,
    }


def test_notice_audience_visibility(client):
    ctx = _setup(client)
    admin = ctx["admin"]
    for payload in (
        {"title": "School reopens", "body": "Monday", "audience": "all", "is_pinned": True},
        {"title": "Staff meeting", "body": "3pm", "audience": "staff"},
        {"title": "Parents day", "body": "Sat", "audience": "parents"},
        {"title": "Grade 6 trip", "body": "Fri", "audience": "classes", "class_ids": [ctx["g6"]["id"]]},
        {"title": "Grade 5 test", "body": "Thu", "audience": "classes", "class_ids": [ctx["g5"]["id"]]},
        {"title": "Old notice", "body": "x", "audience": "all", "publish_date": "2020-01-01", "expiry_date": "2020-02-01"},
    ):
        r = client.post(f"{BASE}/notices", json=payload, headers=admin)
        assert r.status_code == 201, r.text

    def titles(h):
        return {n["title"] for n in client.get(f"{BASE}/notices", headers=h).json()}

    assert titles(ctx["student"]) == {"School reopens", "Grade 5 test"}
    assert titles(ctx["other_student"]) == {"School reopens", "Grade 6 trip"}
    assert titles(ctx["parent"]) == {"School reopens", "Parents day", "Grade 5 test"}
    assert "Staff meeting" in titles(ctx["teacher"]) and "Parents day" not in titles(ctx["teacher"])
    assert len(client.get(f"{BASE}/notices?include_inactive=true", headers=admin).json()) == 6
    assert client.get(f"{BASE}/notices", headers=admin).json()[0]["title"] == "School reopens"  # pinned first

    assert client.post(f"{BASE}/notices", json={"title": "No", "body": "x"}, headers=ctx["teacher"]).status_code == 403
    assert client.post(f"{BASE}/notices", json={"title": "Bad", "body": "x", "audience": "classes"}, headers=admin).status_code == 400


def test_diary_visibility_and_ownership(client):
    ctx = _setup(client)
    r = client.post(
        f"{BASE}/diary",
        json={"class_grade_id": ctx["g5"]["id"], "section_id": ctx["sec_a"]["id"], "subject_id": ctx["subj"]["id"],
              "diary_date": "2026-10-09", "homework": "Read chapter 3"},
        headers=ctx["teacher"],
    )
    assert r.status_code == 201, r.text
    entry = r.json()
    assert entry["subject_name"] == "English" and entry["posted_by_name"] == "Tom Teacher"
    client.post(f"{BASE}/diary", json={"class_grade_id": ctx["g5"]["id"], "section_id": ctx["sec_b"]["id"],
                                       "diary_date": "2026-10-09", "homework": "Section B only"}, headers=ctx["admin"])
    client.post(f"{BASE}/diary", json={"class_grade_id": ctx["g5"]["id"], "diary_date": "2026-10-09",
                                       "homework": "Whole class"}, headers=ctx["admin"])

    student_view = client.get(f"{BASE}/diary?date=2026-10-09", headers=ctx["student"]).json()
    assert {e["homework"] for e in student_view} == {"Read chapter 3", "Whole class"}
    assert client.get(f"{BASE}/diary", headers=ctx["other_student"]).json() == []

    parent_view = client.get(f"{BASE}/diary?student_id={ctx['student_obj']['id']}", headers=ctx["parent"]).json()
    assert {e["homework"] for e in parent_view} == {"Read chapter 3", "Whole class"}

    # Mismatched section/class rejected; students cannot post; teacher can't edit admin's entry.
    bad = client.post(f"{BASE}/diary", json={"class_grade_id": ctx["g6"]["id"], "section_id": ctx["sec_a"]["id"],
                                             "homework": "x"}, headers=ctx["teacher"])
    assert bad.status_code == 400
    assert client.post(f"{BASE}/diary", json={"class_grade_id": ctx["g5"]["id"], "homework": "x"},
                       headers=ctx["student"]).status_code == 403
    admin_entry = [e for e in client.get(f"{BASE}/diary", headers=ctx["admin"]).json() if e["homework"] == "Whole class"][0]
    assert client.delete(f"{BASE}/diary/{admin_entry['id']}", headers=ctx["teacher"]).status_code == 403
    assert client.patch(f"{BASE}/diary/{entry['id']}", json={"homework": "Read ch 4"}, headers=ctx["teacher"]).status_code == 200


def test_parent_cannot_view_unlinked_child_diary(client):
    ctx = _setup(client)
    other = client.get("/api/v1/students", headers=ctx["admin"]).json()
    other_id = [s for s in other if s["full_name"] == "Other Kid"][0]["id"]
    assert client.get(f"{BASE}/diary?student_id={other_id}", headers=ctx["parent"]).status_code == 404


def test_message_threads_unread_and_permissions(client):
    ctx = _setup(client)
    contacts = client.get(f"{BASE}/messages/contacts", headers=ctx["parent"]).json()
    assert {c["role"] for c in contacts} <= {"admin", "teacher"}
    teacher_id = [c for c in contacts if c["full_name"] == "Tom Teacher"][0]["user_id"]

    r = client.post(f"{BASE}/messages/threads",
                    json={"subject": "Homework", "participant_user_ids": [teacher_id], "body": "Is there a test?"},
                    headers=ctx["parent"])
    assert r.status_code == 201, r.text
    thread = r.json()
    assert len(thread["messages"]) == 1 and thread["messages"][0]["is_mine"]

    assert client.get(f"{BASE}/messages/unread-count", headers=ctx["teacher"]).json()["unread"] == 1
    assert client.get(f"{BASE}/messages/unread-count", headers=ctx["parent"]).json()["unread"] == 0
    assert client.get(f"{BASE}/messages/threads", headers=ctx["teacher"]).json()[0]["unread_count"] == 1

    detail = client.get(f"{BASE}/messages/threads/{thread['id']}", headers=ctx["teacher"]).json()
    assert detail["unread_count"] == 0
    assert client.get(f"{BASE}/messages/unread-count", headers=ctx["teacher"]).json()["unread"] == 0

    reply = client.post(f"{BASE}/messages/threads/{thread['id']}/messages", json={"body": "Yes, on Friday"}, headers=ctx["teacher"])
    assert reply.status_code == 201 and len(reply.json()["messages"]) == 2
    assert client.get(f"{BASE}/messages/unread-count", headers=ctx["parent"]).json()["unread"] == 1

    # Outsider can't read; parent can't message a student.
    assert client.get(f"{BASE}/messages/threads/{thread['id']}", headers=ctx["student"]).status_code == 404
    student_user_id = client.get("/api/v1/auth/me", headers=ctx["student"]).json()["id"]
    forbidden = client.post(f"{BASE}/messages/threads",
                            json={"subject": "Hi", "participant_user_ids": [student_user_id], "body": "x"},
                            headers=ctx["parent"])
    assert forbidden.status_code == 403


def test_events_month_list_and_audience(client):
    ctx = _setup(client)
    admin = ctx["admin"]
    for payload in (
        {"title": "Winter break", "start_date": "2026-12-20", "end_date": "2027-01-02", "event_type": "holiday"},
        {"title": "PTM", "start_date": "2026-12-05", "event_type": "meeting", "audience": "parents"},
        {"title": "Staff training", "start_date": "2026-12-06", "audience": "staff"},
        {"title": "Sports day", "start_date": "2026-11-15"},
    ):
        assert client.post(f"{BASE}/events", json=payload, headers=admin).status_code == 201

    dec_admin = client.get(f"{BASE}/events?year=2026&month=12", headers=admin).json()
    assert {e["title"] for e in dec_admin} == {"Winter break", "PTM", "Staff training"}
    jan = client.get(f"{BASE}/events?year=2027&month=1", headers=ctx["student"]).json()
    assert [e["title"] for e in jan] == ["Winter break"]
    assert {e["title"] for e in client.get(f"{BASE}/events?year=2026&month=12", headers=ctx["parent"]).json()} == {"Winter break", "PTM"}
    assert {e["title"] for e in client.get(f"{BASE}/events?year=2026&month=12", headers=ctx["teacher"]).json()} == {"Winter break", "Staff training"}
    assert client.post(f"{BASE}/events", json={"title": "x y", "start_date": "2026-12-01"}, headers=ctx["teacher"]).status_code == 403
    bad = client.post(f"{BASE}/events", json={"title": "Bad", "start_date": "2026-12-05", "end_date": "2026-12-01"}, headers=admin)
    assert bad.status_code == 400


def test_todos_are_per_user(client):
    ctx = _setup(client)
    todo = client.post(f"{BASE}/todos", json={"title": "Prepare notices", "due_date": "2026-10-10"}, headers=ctx["admin"]).json()
    assert todo["is_done"] is False
    done = client.patch(f"{BASE}/todos/{todo['id']}", json={"is_done": True}, headers=ctx["admin"])
    assert done.json()["is_done"] is True
    assert client.get(f"{BASE}/todos?include_done=false", headers=ctx["admin"]).json() == []
    assert client.get(f"{BASE}/todos", headers=ctx["teacher"]).json() == []
    assert client.patch(f"{BASE}/todos/{todo['id']}", json={"is_done": False}, headers=ctx["teacher"]).status_code == 404
    assert client.delete(f"{BASE}/todos/{todo['id']}", headers=ctx["admin"]).status_code == 204


def test_sms_to_class_parents_logs_skipped(client):
    ctx = _setup(client)
    r = client.post(f"{BASE}/sms/send",
                    json={"audience": "class_parents", "class_grade_id": ctx["g5"]["id"], "message": "School closed tomorrow"},
                    headers=ctx["admin"])
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["recipients"] == 1
    assert result["sms_skipped"] == 1 and result["sms_sent"] == 0
    assert result["email_skipped"] == 1

    logs = client.get(f"{BASE}/sms/logs", headers=ctx["admin"]).json()
    assert {log["channel"] for log in logs} == {"sms", "email"}
    assert all(log["status"] == "skipped" for log in logs)

    g6 = client.post(f"{BASE}/sms/send", json={"audience": "class_parents", "class_grade_id": ctx["g6"]["id"], "message": "x"},
                     headers=ctx["admin"]).json()
    assert g6["recipients"] == 0
    assert client.post(f"{BASE}/sms/send", json={"audience": "all_parents", "message": "x"}, headers=ctx["teacher"]).status_code == 403


def test_communication_tenant_isolation(client):
    ctx = _setup(client)
    notice = client.post(f"{BASE}/notices", json={"title": "Private", "body": "x"}, headers=ctx["admin"]).json()
    other = auth_headers(onboard_and_login_admin(client, slug="riverside"))
    assert client.get(f"{BASE}/notices", headers=other).json() == []
    assert client.patch(f"{BASE}/notices/{notice['id']}", json={"title": "Hacked"}, headers=other).status_code == 404
    teacher_id = client.get("/api/v1/auth/me", headers=ctx["teacher"]).json()["id"]
    r = client.post(f"{BASE}/messages/threads", json={"subject": "x", "participant_user_ids": [teacher_id], "body": "x"}, headers=other)
    assert r.status_code == 404
