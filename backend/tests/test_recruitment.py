from tests.conftest import auth_headers, login, onboard_and_login_admin

BASE = "/api/v1/recruitment"


def test_recruitment_pipeline(client):
    headers = auth_headers(onboard_and_login_admin(client))
    v = client.post(f"{BASE}/vacancies", json={"title": "Maths Teacher", "department": "Academics", "positions": 2}, headers=headers)
    assert v.status_code == 201, v.text
    vid = v.json()["id"]
    assert v.json()["status"] == "open" and v.json()["application_count"] == 0

    a1 = client.post(f"{BASE}/applications", json={"vacancy_id": vid, "candidate_name": "Sara Ali", "email": "sara@x.com", "experience_years": 5}, headers=headers)
    assert a1.status_code == 201 and a1.json()["stage"] == "applied" and a1.json()["vacancy_title"] == "Maths Teacher"
    client.post(f"{BASE}/applications", json={"vacancy_id": vid, "candidate_name": "Omar Khan"}, headers=headers)

    assert client.get(f"{BASE}/vacancies", headers=headers).json()[0]["application_count"] == 2

    # move Sara through the pipeline: shortlist → interview (schedule) → hired
    aid = a1.json()["id"]
    client.patch(f"{BASE}/applications/{aid}", json={"stage": "interview", "interview_at": "2026-10-20T10:00:00", "interviewer": "Principal"}, headers=headers)
    hired = client.patch(f"{BASE}/applications/{aid}", json={"stage": "hired", "interview_result": "pass"}, headers=headers).json()
    assert hired["stage"] == "hired" and hired["interview_result"] == "pass" and hired["interviewer"] == "Principal"

    assert client.get(f"{BASE}/vacancies", headers=headers).json()[0]["hired_count"] == 1
    assert len(client.get(f"{BASE}/applications?stage=hired", headers=headers).json()) == 1

    # close the vacancy
    closed = client.patch(f"{BASE}/vacancies/{vid}", json={"status": "closed"}, headers=headers).json()
    assert closed["status"] == "closed"
    # validation
    assert client.post(f"{BASE}/applications", json={"vacancy_id": vid, "candidate_name": "X"}, headers=headers).status_code == 201
    assert client.patch(f"{BASE}/applications/{aid}", json={"stage": "bogus"}, headers=headers).status_code == 422


def test_recruitment_is_admin_only(client):
    headers = auth_headers(onboard_and_login_admin(client))
    klass = client.post("/api/v1/classes", json={"name": "G1", "level_order": 1, "academic_year": "2026"}, headers=headers).json()
    client.post("/api/v1/students", json={"full_name": "P Q", "email": "pq@greenwood.example.com", "password": "Password123!", "class_grade_id": klass["id"]}, headers=headers)
    student = auth_headers(login(client, "greenwood", "pq@greenwood.example.com", "Password123!"))
    assert client.get(f"{BASE}/vacancies", headers=student).status_code == 403
