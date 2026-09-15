from datetime import date

import httpx

import app.services.whatsapp_service as whatsapp_service
from tests.conftest import auth_headers, onboard_and_login_admin

TODAY = date.today()


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


def link_parent(client, headers, student_id, phone_number="03001234567", email="parent@greenwood.example.com"):
    response = client.post(
        f"/api/v1/students/{student_id}/parents",
        json={"full_name": "Pat Parent", "email": email, "password": "Password123!", "phone_number": phone_number},
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
            "day_of_week": TODAY.weekday(),
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


class FakeResponse:
    def __init__(self, status_code=200, json_body=None):
        self.status_code = status_code
        self._json_body = json_body or (
            {"messages": [{"id": "wamid-test-123"}]} if status_code < 400 else {"error": {"message": "Simulated failure"}}
        )

    def json(self):
        return self._json_body

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://graph.facebook.com/fake")
            response = httpx.Response(self.status_code, request=request, json=self._json_body)
            raise httpx.HTTPStatusError("error", request=request, response=response)


def _configure_whatsapp(monkeypatch, token="test-token", phone_id="12345"):
    monkeypatch.setattr(whatsapp_service.settings, "WHATSAPP_ACCESS_TOKEN", token)
    monkeypatch.setattr(whatsapp_service.settings, "WHATSAPP_PHONE_NUMBER_ID", phone_id)
    # WhatsAppService.is_configured() also gates on ENVIRONMENT != "testing" so a real .env
    # credential can never leak into an unmocked network call in the test suite — bypass just
    # that guard here since these tests replace httpx.post with a fake anyway.
    monkeypatch.setattr(whatsapp_service.WhatsAppService, "is_configured", lambda self: True)


def test_attendance_absent_notification_skipped_when_not_configured(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"])
    teacher_headers = _login(client, teacher["email"])

    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": TODAY.isoformat(), "end_date": TODAY.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "absent"}]},
        headers=teacher_headers,
    )

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    absent_logs = [log for log in logs if log["event"] == "attendance_absent"]
    whatsapp_logs = [log for log in absent_logs if log["channel"] == "whatsapp"]
    email_logs = [log for log in absent_logs if log["channel"] == "email"]
    assert len(whatsapp_logs) == 1
    assert whatsapp_logs[0]["status"] == "skipped"
    assert whatsapp_logs[0]["recipient_phone"] == "+923001234567"  # normalized to E.164
    assert len(email_logs) == 1
    assert email_logs[0]["status"] == "skipped"  # SMTP not configured in tests
    assert email_logs[0]["recipient_email"] == "parent@greenwood.example.com"


def test_attendance_absent_notification_skipped_when_no_parent_linked(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])

    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": TODAY.isoformat(), "end_date": TODAY.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "absent"}]},
        headers=teacher_headers,
    )

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    absent_logs = [log for log in logs if log["event"] == "attendance_absent"]
    assert len(absent_logs) == 2  # no parent linked: one skipped whatsapp log, one skipped email log
    assert {log["status"] for log in absent_logs} == {"skipped"}
    assert {log["channel"] for log in absent_logs} == {"whatsapp", "email"}
    assert absent_logs[0]["recipient_phone"] is None


def test_present_marking_does_not_notify(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"])
    teacher_headers = _login(client, teacher["email"])

    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": TODAY.isoformat(), "end_date": TODAY.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "present"}]},
        headers=teacher_headers,
    )

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    assert [log for log in logs if log["event"] == "attendance_absent"] == []


def test_attendance_absent_notification_sent_when_configured(client, monkeypatch):
    _configure_whatsapp(monkeypatch)
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append({"url": url, "headers": headers, "json": json})
        return FakeResponse(200)

    monkeypatch.setattr(whatsapp_service.httpx, "post", fake_post)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"], phone_number="03009998877")
    teacher_headers = _login(client, teacher["email"])

    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": TODAY.isoformat(), "end_date": TODAY.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "absent"}]},
        headers=teacher_headers,
    )

    assert len(calls) == 1
    assert calls[0]["json"]["to"] == "+923009998877"  # normalized to E.164
    assert calls[0]["json"]["type"] == "template"
    assert calls[0]["json"]["template"]["name"] == "school_notification"
    assert calls[0]["headers"]["Authorization"] == "Bearer test-token"
    body_params = [p["text"] for p in calls[0]["json"]["template"]["components"][0]["parameters"]]
    assert any("ABSENT" in p for p in body_params)

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    absent_logs = [log for log in logs if log["event"] == "attendance_absent" and log["channel"] == "whatsapp"]
    assert len(absent_logs) == 1
    assert absent_logs[0]["status"] == "sent"
    assert absent_logs[0]["provider_message_id"] == "wamid-test-123"


def test_notification_marked_failed_on_http_error(client, monkeypatch):
    _configure_whatsapp(monkeypatch)

    def fake_post(url, headers=None, json=None, timeout=None):
        return FakeResponse(400, json_body={"error": {"message": "Invalid parameter"}})

    monkeypatch.setattr(whatsapp_service.httpx, "post", fake_post)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"])
    teacher_headers = _login(client, teacher["email"])

    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": TODAY.isoformat(), "end_date": TODAY.isoformat()},
        headers=headers,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers).json()[0]["id"]
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "absent"}]},
        headers=teacher_headers,
    )

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    absent_logs = [log for log in logs if log["event"] == "attendance_absent" and log["channel"] == "whatsapp"]
    assert absent_logs[0]["status"] == "failed"
    assert absent_logs[0]["detail"] is not None


def test_payment_verified_notification(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"])

    client.post(
        "/api/v1/fees/plans",
        json={"class_grade_id": class_grade["id"], "academic_year": "2026-2027", "monthly_amount": 4000},
        headers=headers,
    )
    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": TODAY.month, "period_year": TODAY.year, "due_date": "2026-09-10"},
        headers=headers,
    )
    invoice = generated.json()[0]
    payment = client.post(
        f"/api/v1/fees/invoices/{invoice['id']}/payments",
        params={"amount": 4000, "payment_method": "cash"},
        headers=headers,
    ).json()

    client.post(f"/api/v1/fees/payments/{payment['id']}/verify", json={"approve": True}, headers=headers)

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    verified_logs = [log for log in logs if log["event"] == "payment_verified"]
    assert len(verified_logs) == 2  # one whatsapp, one email
    assert {log["status"] for log in verified_logs} == {"skipped"}  # neither configured in tests
    assert subject and teacher  # sanity


def test_rejected_payment_does_not_notify(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])

    client.post(
        "/api/v1/fees/plans",
        json={"class_grade_id": class_grade["id"], "academic_year": "2026-2027", "monthly_amount": 4000},
        headers=headers,
    )
    generated = client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": TODAY.month, "period_year": TODAY.year, "due_date": "2026-09-10"},
        headers=headers,
    )
    invoice = generated.json()[0]
    payment = client.post(
        f"/api/v1/fees/invoices/{invoice['id']}/payments",
        params={"amount": 4000, "payment_method": "cash"},
        headers=headers,
    ).json()

    client.post(f"/api/v1/fees/payments/{payment['id']}/verify", json={"approve": False}, headers=headers)

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    assert [log for log in logs if log["event"] == "payment_verified"] == []


def test_fee_due_reminders_endpoint(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"])

    client.post(
        "/api/v1/fees/plans",
        json={"class_grade_id": class_grade["id"], "academic_year": "2026-2027", "monthly_amount": 4000},
        headers=headers,
    )
    due_soon = (TODAY).isoformat()
    client.post(
        "/api/v1/fees/invoices/generate",
        json={"class_grade_id": class_grade["id"], "period_month": TODAY.month, "period_year": TODAY.year, "due_date": due_soon},
        headers=headers,
    )

    response = client.post("/api/v1/notifications/fee-due-reminders", json={"days_ahead": 3}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["invoices_checked"] == 1

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    reminder_logs = [log for log in logs if log["event"] == "fee_due_reminder"]
    assert len(reminder_logs) == 2  # one whatsapp, one email
    assert {log["status"] for log in reminder_logs} == {"skipped"}  # neither configured


def test_non_admin_cannot_view_notification_logs(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, _, _, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    response = client.get("/api/v1/notifications/logs", headers=teacher_headers)
    assert response.status_code == 403


def test_parent_can_view_and_update_notification_preferences(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"])
    parent_headers = _login(client, "parent@greenwood.example.com")

    prefs = client.get("/api/v1/parents/me/preferences", headers=parent_headers)
    assert prefs.status_code == 200
    assert prefs.json() == {"whatsapp_opt_in": True, "sms_opt_in": True}

    updated = client.patch(
        "/api/v1/parents/me/preferences", json={"whatsapp_opt_in": False}, headers=parent_headers
    )
    assert updated.status_code == 200
    assert updated.json() == {"whatsapp_opt_in": False, "sms_opt_in": True}


def test_broadcast_skips_opted_out_parents(client, monkeypatch):
    _configure_whatsapp(monkeypatch)
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append(json["to"])
        return FakeResponse(200)

    monkeypatch.setattr(whatsapp_service.httpx, "post", fake_post)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student_a = create_student(client, headers, class_grade["id"], section["id"], email="a@greenwood.example.com")
    student_b = create_student(client, headers, class_grade["id"], section["id"], email="b@greenwood.example.com")
    link_parent(client, headers, student_a["id"], phone_number="03001111111", email="parent_a@greenwood.example.com")
    link_parent(client, headers, student_b["id"], phone_number="03002222222", email="parent_b@greenwood.example.com")

    parent_b_headers = _login(client, "parent_b@greenwood.example.com")
    client.patch("/api/v1/parents/me/preferences", json={"whatsapp_opt_in": False}, headers=parent_b_headers)

    response = client.post(
        "/api/v1/notifications/broadcast",
        json={"class_grade_ids": [class_grade["id"]], "message": "PTA meeting this Friday at 4pm."},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["students_targeted"] == 2
    assert body["notifications_sent"] == 1
    assert calls == ["+923001111111"]  # parent_b opted out, never called (normalized to E.164)

    logs = client.get("/api/v1/notifications/logs", headers=headers).json()
    broadcast_logs = [log for log in logs if log["event"] == "broadcast"]
    # 2 students x 2 channels: whatsapp sent (parent_a) + skipped (parent_b opted out),
    # email skipped for both (SMTP not configured in tests) = 4 logs total.
    assert len(broadcast_logs) == 4
    assert {log["status"] for log in broadcast_logs} == {"sent", "skipped"}
    whatsapp_logs = [log for log in broadcast_logs if log["channel"] == "whatsapp"]
    assert {log["status"] for log in whatsapp_logs} == {"sent", "skipped"}


def test_non_admin_cannot_broadcast(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, _, _, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    response = client.post(
        "/api/v1/notifications/broadcast", json={"message": "Hello"}, headers=teacher_headers
    )
    assert response.status_code == 403


def _capture_emails(monkeypatch):
    sent = []

    def fake_send(self, to_email, subject, body_text, attachments=None):
        sent.append({"to": to_email, "subject": subject, "body": body_text, "attachments": attachments})
        return True

    monkeypatch.setattr("app.services.email_service.EmailService.send", fake_send)
    # NotificationService checks is_configured() before calling send() so it can log SKIPPED
    # rather than FAILED when SMTP genuinely isn't set up — fake that check too, or it'd always
    # report SKIPPED in tests regardless of the send() patch above.
    monkeypatch.setattr("app.services.email_service.EmailService.is_configured", lambda self: True)
    return sent


def test_send_custom_email_to_dynamic_recipient(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    sent.clear()  # drop the admin's own onboarding-verification email

    response = client.post(
        "/api/v1/notifications/send-email",
        json={"to_email": "someone-else@example.com", "subject": "Term report", "message": "Please see attached."},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["channel"] == "email"
    assert body["event"] == "custom_email"
    assert body["status"] == "sent"
    assert body["recipient_email"] == "someone-else@example.com"

    assert len(sent) == 1
    assert sent[0]["to"] == "someone-else@example.com"
    assert sent[0]["subject"] == "Term report"


def test_send_custom_email_requires_admin(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, _, _, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    response = client.post(
        "/api/v1/notifications/send-email",
        json={"to_email": "someone@example.com", "subject": "Hi", "message": "Hi"},
        headers=teacher_headers,
    )
    assert response.status_code == 403


def test_email_report_card_to_parents_on_file(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"], email="parent@greenwood.example.com")
    sent.clear()  # drop the admin's and parent's onboarding/creation verification emails

    response = client.post(
        f"/api/v1/students/{student['id']}/report-card/email",
        json={"period_month": TODAY.month, "period_year": TODAY.year},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    logs = response.json()
    assert len(logs) == 1
    assert logs[0]["status"] == "sent"
    assert logs[0]["event"] == "report_card"
    assert logs[0]["recipient_email"] == "parent@greenwood.example.com"

    assert len(sent) == 1
    assert sent[0]["to"] == "parent@greenwood.example.com"
    assert sent[0]["attachments"][0][0] == "report-card.pdf"


def test_email_report_card_to_override_address(client, monkeypatch):
    sent = _capture_emails(monkeypatch)
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    sent.clear()  # drop the admin's onboarding-verification email

    response = client.post(
        f"/api/v1/students/{student['id']}/report-card/email",
        json={"to_email": "guardian@example.com"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    logs = response.json()
    assert len(logs) == 1
    assert logs[0]["recipient_email"] == "guardian@example.com"
    assert sent[0]["to"] == "guardian@example.com"


def test_admin_can_send_whatsapp_notification(client, monkeypatch):
    _configure_whatsapp(monkeypatch)
    calls = []

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append(json)
        return FakeResponse(200)

    monkeypatch.setattr(whatsapp_service.httpx, "post", fake_post)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"], phone_number="03001234567")

    response = client.post(
        "/api/v1/notifications/send",
        json={
            "student_id": student["id"],
            "title": "Exam Schedule",
            "message": "Your Mathematics exam is scheduled for 20 September at 9:00 AM.",
            "channel": "whatsapp",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    logs = response.json()
    assert len(logs) == 1
    assert logs[0]["channel"] == "whatsapp"
    assert logs[0]["event"] == "admin_notification"
    assert logs[0]["status"] == "sent"
    assert logs[0]["recipient_phone"] == "+923001234567"
    assert logs[0]["provider_message_id"] == "wamid-test-123"

    assert len(calls) == 1  # only whatsapp called — email must NOT also fire
    assert calls[0]["type"] == "template"
    params = [p["text"] for p in calls[0]["template"]["components"][0]["parameters"]]
    assert "Exam Schedule" in params
    assert "Your Mathematics exam is scheduled for 20 September at 9:00 AM." in params


def test_admin_can_send_email_notification_and_only_email_fires(client, monkeypatch):
    _configure_whatsapp(monkeypatch)
    whatsapp_calls = []
    monkeypatch.setattr(whatsapp_service.httpx, "post", lambda *a, **k: whatsapp_calls.append(1) or FakeResponse(200))
    sent = _capture_emails(monkeypatch)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"], phone_number="03001234567", email="parent@greenwood.example.com")
    sent.clear()  # drop onboarding/creation verification emails

    response = client.post(
        "/api/v1/notifications/send",
        json={"student_id": student["id"], "title": "Exam Schedule", "message": "Your exam is on 20 September.", "channel": "email"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    logs = response.json()
    assert len(logs) == 1
    assert logs[0]["channel"] == "email"
    assert logs[0]["status"] == "sent"
    assert logs[0]["recipient_email"] == "parent@greenwood.example.com"

    assert len(sent) == 1  # email fired
    assert whatsapp_calls == []  # whatsapp must NOT also fire


def test_send_notification_rejects_invalid_channel(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])

    response = client.post(
        "/api/v1/notifications/send",
        json={"student_id": student["id"], "title": "Hi", "message": "Hi", "channel": "sms"},
        headers=headers,
    )
    assert response.status_code == 422

    response = client.post(
        "/api/v1/notifications/send",
        json={"student_id": student["id"], "title": "Hi", "message": "Hi", "channel": "telegram"},
        headers=headers,
    )
    assert response.status_code == 422


def test_send_notification_handles_missing_whatsapp_number(client, monkeypatch):
    _configure_whatsapp(monkeypatch)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    # no parent linked at all -> no WhatsApp number on file anywhere

    response = client.post(
        "/api/v1/notifications/send",
        json={"student_id": student["id"], "title": "Hi", "message": "Hi", "channel": "whatsapp"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    logs = response.json()
    assert len(logs) == 1
    assert logs[0]["status"] == "failed"
    assert "no" in logs[0]["detail"].lower() or "opted out" in logs[0]["detail"].lower()


def test_send_notification_handles_whatsapp_api_failure(client, monkeypatch):
    _configure_whatsapp(monkeypatch)

    def fake_post(url, headers=None, json=None, timeout=None):
        return FakeResponse(401, json_body={"error": {"message": "Invalid OAuth access token"}})

    monkeypatch.setattr(whatsapp_service.httpx, "post", fake_post)

    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    link_parent(client, headers, student["id"], phone_number="03001234567")

    response = client.post(
        "/api/v1/notifications/send",
        json={"student_id": student["id"], "title": "Hi", "message": "Hi", "channel": "whatsapp"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    logs = response.json()
    assert logs[0]["status"] == "failed"
    assert logs[0]["detail"] == "Invalid OAuth access token"
    # the raw access token itself must never be echoed back to the caller
    assert "test-token" not in response.text


def test_send_notification_requires_admin(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])

    response = client.post(
        "/api/v1/notifications/send",
        json={"student_id": student["id"], "title": "Hi", "message": "Hi", "channel": "whatsapp"},
        headers=teacher_headers,
    )
    assert response.status_code == 403


def test_student_cannot_send_notification(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"], email="stu@greenwood.example.com")
    student_headers = _login(client, "stu@greenwood.example.com")

    response = client.post(
        "/api/v1/notifications/send",
        json={"student_id": student["id"], "title": "Hi", "message": "Hi", "channel": "whatsapp"},
        headers=student_headers,
    )
    assert response.status_code == 403

    # a student also can't reach any other notification-sending endpoint
    response = client.post(
        "/api/v1/notifications/send-email",
        json={"to_email": "x@example.com", "subject": "Hi", "message": "Hi"},
        headers=student_headers,
    )
    assert response.status_code == 403


def test_whatsapp_credentials_loaded_from_environment(monkeypatch):
    monkeypatch.setattr(whatsapp_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(whatsapp_service.settings, "WHATSAPP_ACCESS_TOKEN", "env-token")
    monkeypatch.setattr(whatsapp_service.settings, "WHATSAPP_PHONE_NUMBER_ID", "env-phone-id")
    svc = whatsapp_service.WhatsAppService()
    assert svc.is_configured() is True

    monkeypatch.setattr(whatsapp_service.settings, "WHATSAPP_ACCESS_TOKEN", None)
    assert svc.is_configured() is False


def test_whatsapp_phone_number_validation():
    svc = whatsapp_service.WhatsAppService()
    assert svc.validate_phone_number("03001234567") == "+923001234567"
    assert svc.validate_phone_number("+923001234567") == "+923001234567"
    assert svc.validate_phone_number("not-a-number") is None
    assert svc.validate_phone_number(None) is None
    assert svc.validate_phone_number("") is None


def test_notification_logs_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    class_grade, section, subject, teacher = _setup(client, headers_a)
    student = create_student(client, headers_a, class_grade["id"], section["id"])
    link_parent(client, headers_a, student["id"])
    teacher_headers = _login(client, teacher["email"])

    client.post(
        "/api/v1/schedule/sessions/generate",
        json={"start_date": TODAY.isoformat(), "end_date": TODAY.isoformat()},
        headers=headers_a,
    )
    session_id = client.get("/api/v1/schedule/sessions", headers=headers_a).json()[0]["id"]
    client.post(
        f"/api/v1/attendance/sessions/{session_id}",
        json={"records": [{"student_id": student["id"], "status": "absent"}]},
        headers=teacher_headers,
    )

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/notifications/logs", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []
