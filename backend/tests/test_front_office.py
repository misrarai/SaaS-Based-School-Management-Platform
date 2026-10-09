from tests.conftest import auth_headers, login, onboard_and_login_admin

BASE = "/api/v1/front-office"


def _class(client, headers, name="Grade 5"):
    r = client.post("/api/v1/classes", json={"name": name, "level_order": 5, "academic_year": "2026"}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _student(client, headers, class_id, email="sam@greenwood.example.com"):
    r = client.post(
        "/api/v1/students",
        json={"full_name": "Sam Student", "email": email, "password": "Password123!", "class_grade_id": class_id},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _teacher_headers(client, admin_headers):
    client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": "tom@greenwood.example.com", "password": "Password123!"},
        headers=admin_headers,
    )
    return auth_headers(login(client, "greenwood", "tom@greenwood.example.com", "Password123!"))


def test_enquiry_lifecycle_summary_follow_up_and_convert(client):
    headers = auth_headers(onboard_and_login_admin(client))
    grade = _class(client, headers)

    r = client.post(
        f"{BASE}/enquiries",
        json={
            "student_name": "Ayesha Khan",
            "parent_name": "Imran Khan",
            "phone": "03001234567",
            "class_grade_id": grade["id"],
            "source": "facebook",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    enquiry = r.json()
    assert enquiry["status"] == "new"
    assert enquiry["class_interested"] == "Grade 5"

    client.post(f"{BASE}/enquiries", json={"student_name": "Bilal", "status": "closed"}, headers=headers)

    summary = client.get(f"{BASE}/enquiries/summary", headers=headers).json()
    assert summary["total"] == 2 and summary["new"] == 1 and summary["closed"] == 1

    r = client.post(
        f"{BASE}/enquiries/{enquiry['id']}/follow-ups",
        json={"note": "Called, will visit on Monday", "next_follow_up_date": "2026-10-12"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    detail = client.get(f"{BASE}/enquiries/{enquiry['id']}", headers=headers).json()
    assert detail["status"] == "follow_up"
    assert detail["follow_up_date"] == "2026-10-12"
    assert len(client.get(f"{BASE}/enquiries/{enquiry['id']}/follow-ups", headers=headers).json()) == 1

    by_status = client.get(f"{BASE}/enquiries?status=follow_up", headers=headers).json()
    assert [e["id"] for e in by_status] == [enquiry["id"]]

    prefill = client.post(f"{BASE}/enquiries/{enquiry['id']}/convert", headers=headers)
    assert prefill.status_code == 200, prefill.text
    body = prefill.json()
    assert body["full_name"] == "Ayesha Khan"
    assert body["guardian_name"] == "Imran Khan"
    assert body["class_grade_id"] == grade["id"]
    assert body["admission_detail"]["father_mobile"] == "03001234567"
    assert client.get(f"{BASE}/enquiries/{enquiry['id']}", headers=headers).json()["status"] == "converted"

    assert client.delete(f"{BASE}/enquiries/{enquiry['id']}", headers=headers).status_code == 204


def test_visitor_check_in_and_out(client):
    headers = auth_headers(onboard_and_login_admin(client))
    r = client.post(
        f"{BASE}/visitors",
        json={"visitor_name": "Kamran", "purpose": "Meet principal", "cnic": "35202-1234567-1", "number_of_persons": 2},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    visitor = r.json()
    assert visitor["out_time"] is None

    inside = client.get(f"{BASE}/visitors?inside_only=true", headers=headers).json()
    assert len(inside) == 1

    out = client.post(f"{BASE}/visitors/{visitor['id']}/check-out", json={}, headers=headers)
    assert out.status_code == 200, out.text
    assert out.json()["out_time"] is not None
    assert client.post(f"{BASE}/visitors/{visitor['id']}/check-out", json={}, headers=headers).status_code == 400
    assert client.get(f"{BASE}/visitors?inside_only=true", headers=headers).json() == []


def test_complaints_postal_and_calls_crud(client):
    headers = auth_headers(onboard_and_login_admin(client))

    c = client.post(
        f"{BASE}/complaints",
        json={"complainant_name": "Mr. Ali", "complaint_type": "Transport", "description": "Van late"},
        headers=headers,
    ).json()
    assert c["status"] == "open"
    upd = client.patch(
        f"{BASE}/complaints/{c['id']}", json={"status": "resolved", "action_taken": "Driver warned"}, headers=headers
    )
    assert upd.json()["status"] == "resolved"
    assert client.get(f"{BASE}/complaints?status=open", headers=headers).json() == []

    client.post(f"{BASE}/postal", json={"record_type": "received", "title": "Board letter"}, headers=headers)
    client.post(f"{BASE}/postal", json={"record_type": "dispatched", "title": "Results"}, headers=headers)
    assert len(client.get(f"{BASE}/postal?type=received", headers=headers).json()) == 1
    assert client.post(f"{BASE}/postal", json={"record_type": "lost", "title": "x"}, headers=headers).status_code == 422

    call = client.post(
        f"{BASE}/calls", json={"caller_name": "Sana", "purpose": "Fee query", "call_type": "outgoing"}, headers=headers
    ).json()
    assert call["call_type"] == "outgoing"
    assert len(client.get(f"{BASE}/calls?type=incoming", headers=headers).json()) == 0
    assert client.delete(f"{BASE}/calls/{call['id']}", headers=headers).status_code == 204


def test_gate_pass_by_admission_number_and_pdf(client):
    headers = auth_headers(onboard_and_login_admin(client))
    grade = _class(client, headers)
    student = _student(client, headers, grade["id"])
    adm = student["admission_number"]
    assert adm

    lookup = client.get(f"{BASE}/gate-passes/student-lookup?admission_number={adm}", headers=headers)
    assert lookup.status_code == 200, lookup.text
    assert lookup.json()["full_name"] == "Sam Student"

    r = client.post(
        f"{BASE}/gate-passes",
        json={"admission_number": adm, "reason": "Doctor appointment", "guardian_name": "Pat Parent"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    gp = r.json()
    assert gp["pass_number"] == 1
    assert gp["class_name"] == "Grade 5"
    assert gp["approved_by"] == "Alice Admin"

    pdf = client.get(f"{BASE}/gate-passes/{gp['id']}/pdf", headers=headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")

    missing = client.post(
        f"{BASE}/gate-passes", json={"admission_number": "9999", "reason": "x", "guardian_name": "Someone"}, headers=headers
    )
    assert missing.status_code == 404


def test_front_office_is_admin_only_and_tenant_scoped(client):
    headers = auth_headers(onboard_and_login_admin(client))
    teacher_headers = _teacher_headers(client, headers)
    assert client.get(f"{BASE}/enquiries", headers=teacher_headers).status_code == 403
    assert client.post(f"{BASE}/visitors", json={"visitor_name": "X Y", "purpose": "p"}, headers=teacher_headers).status_code == 403

    enquiry = client.post(f"{BASE}/enquiries", json={"student_name": "Zara"}, headers=headers).json()
    other = auth_headers(onboard_and_login_admin(client, slug="riverside"))
    assert client.get(f"{BASE}/enquiries/{enquiry['id']}", headers=other).status_code == 404
    assert client.get(f"{BASE}/enquiries", headers=other).json() == []
