from tests.conftest import auth_headers, login, onboard_and_login_admin

BASE = "/api/v1/promotion"


def _class(client, headers, name, level):
    return client.post("/api/v1/classes", json={"name": name, "level_order": level, "academic_year": "2026"}, headers=headers).json()


def _student(client, headers, class_id, email, roll):
    return client.post("/api/v1/students", json={"full_name": email.split("@")[0].title(), "email": email, "password": "Password123!", "class_grade_id": class_id, "roll_number": roll}, headers=headers).json()


def test_promotion_rule_candidates_and_execute(client):
    headers = auth_headers(onboard_and_login_admin(client))
    g5 = _class(client, headers, "Grade 5", 5)
    g6 = _class(client, headers, "Grade 6", 6)
    s1 = _student(client, headers, g5["id"], "ann@greenwood.example.com", "1")
    s2 = _student(client, headers, g5["id"], "ben@greenwood.example.com", "2")
    s3 = _student(client, headers, g5["id"], "cal@greenwood.example.com", "3")

    rule = client.post(f"{BASE}/rules", json={"source_class_id": g5["id"], "target_class_id": g6["id"], "pass_mark": 40}, headers=headers)
    assert rule.status_code == 201, rule.text
    assert rule.json()["source_class_name"] == "Grade 5" and rule.json()["target_class_name"] == "Grade 6"

    cands = client.get(f"{BASE}/candidates?source_class_id={g5['id']}", headers=headers).json()
    assert len(cands) == 3 and cands[0]["roll_number"] == "1"

    # promote two of three to Grade 6
    res = client.post(f"{BASE}/execute", json={"source_class_id": g5["id"], "target_class_id": g6["id"], "student_ids": [s1["id"], s2["id"]]}, headers=headers)
    assert res.status_code == 200 and res.json() == {"promoted": 2, "graduated": 0}

    # Grade 5 now has 1, Grade 6 has 2
    assert len(client.get(f"{BASE}/candidates?source_class_id={g5['id']}", headers=headers).json()) == 1
    assert len(client.get(f"{BASE}/candidates?source_class_id={g6['id']}", headers=headers).json()) == 2

    # graduate the remaining student (no target)
    grad = client.post(f"{BASE}/execute", json={"source_class_id": g5["id"], "student_ids": [s3["id"]]}, headers=headers).json()
    assert grad == {"promoted": 0, "graduated": 1}
    assert len(client.get(f"{BASE}/candidates?source_class_id={g5['id']}", headers=headers).json()) == 0

    assert client.delete(f"{BASE}/rules/{rule.json()['id']}", headers=headers).status_code == 204


def test_promotion_is_admin_only(client):
    headers = auth_headers(onboard_and_login_admin(client))
    g1 = _class(client, headers, "Grade 1", 1)
    _student(client, headers, g1["id"], "pupil@greenwood.example.com", "1")
    student = auth_headers(login(client, "greenwood", "pupil@greenwood.example.com", "Password123!"))
    assert client.get(f"{BASE}/rules", headers=student).status_code == 403
