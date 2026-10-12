from tests.conftest import auth_headers, onboard_and_login_admin

BASE = "/api/v1/automation"


def test_automation_rule_crud_and_test(client):
    headers = auth_headers(onboard_and_login_admin(client))

    r = client.post(f"{BASE}/rules", json={
        "name": "Absence SMS", "event": "student_absent", "channel": "sms",
        "message_template": "Dear parent, {student_name} was absent on {date}.",
    }, headers=headers)
    assert r.status_code == 201, r.text
    rule = r.json()
    assert rule["is_active"] and rule["event"] == "student_absent"

    # list + filter by event
    assert len(client.get(f"{BASE}/rules", headers=headers).json()) == 1
    assert len(client.get(f"{BASE}/rules?event=payment_verified", headers=headers).json()) == 0

    # test renders the template with sample tokens
    tested = client.post(f"{BASE}/rules/{rule['id']}/test", headers=headers).json()
    assert "Ali Khan" in tested["preview"] and "2026-10-12" in tested["preview"]
    assert "not configured" in tested["detail"]  # SMS gateway off in testing

    # update (deactivate) + validation
    upd = client.patch(f"{BASE}/rules/{rule['id']}", json={"is_active": False}, headers=headers).json()
    assert upd["is_active"] is False
    assert client.post(f"{BASE}/rules", json={"name": "x", "event": "bogus", "channel": "sms", "message_template": "y"}, headers=headers).status_code == 422

    assert client.delete(f"{BASE}/rules/{rule['id']}", headers=headers).status_code == 204
    assert len(client.get(f"{BASE}/rules", headers=headers).json()) == 0


def test_automation_is_admin_only(client):
    from tests.conftest import login
    headers = auth_headers(onboard_and_login_admin(client))
    klass = client.post("/api/v1/classes", json={"name": "G1", "level_order": 1, "academic_year": "2026"}, headers=headers).json()
    client.post("/api/v1/students", json={"full_name": "P Q", "email": "pq@greenwood.example.com", "password": "Password123!", "class_grade_id": klass["id"]}, headers=headers)
    student = auth_headers(login(client, "greenwood", "pq@greenwood.example.com", "Password123!"))
    assert client.get(f"{BASE}/rules", headers=student).status_code == 403
