from tests.conftest import auth_headers, login, onboard_and_login_admin

BASE = "/api/v1/hifz"


def _class(client, headers):
    return client.post("/api/v1/classes", json={"name": "Hifz Class", "level_order": 1, "academic_year": "2026"}, headers=headers).json()


def _student(client, headers, class_id, email):
    return client.post("/api/v1/students", json={"full_name": email.split("@")[0].title(), "email": email, "password": "Password123!", "class_grade_id": class_id}, headers=headers).json()


def test_hifz_halqa_enrolment_and_daily_records(client):
    headers = auth_headers(onboard_and_login_admin(client))
    klass = _class(client, headers)
    s1 = _student(client, headers, klass["id"], "ahmed@greenwood.example.com")
    s2 = _student(client, headers, klass["id"], "bilal@greenwood.example.com")

    halqa = client.post(f"{BASE}/halqas", json={"name": "Morning Halqa", "incharge": "Qari Sahab"}, headers=headers)
    assert halqa.status_code == 201, halqa.text
    hid = halqa.json()["id"]
    assert halqa.json()["student_count"] == 0

    en = client.post(f"{BASE}/enrolments", json={"halqa_id": hid, "student_id": s1["id"], "current_juz": 5, "current_page": 3}, headers=headers)
    assert en.status_code == 201, en.text
    enid = en.json()["id"]
    assert en.json()["student_name"] == "Ahmed" and en.json()["current_juz"] == 5

    # duplicate active enrolment rejected
    assert client.post(f"{BASE}/enrolments", json={"halqa_id": hid, "student_id": s1["id"]}, headers=headers).status_code == 409
    client.post(f"{BASE}/enrolments", json={"halqa_id": hid, "student_id": s2["id"]}, headers=headers)

    # halqa now shows 2 active students
    halqas = client.get(f"{BASE}/halqas", headers=headers).json()
    assert halqas[0]["student_count"] == 2

    # daily records
    r = client.post(f"{BASE}/enrolments/{enid}/records", json={"sabaq": "Juz 5 p.4", "sabqi": "Juz 4", "manzil": "Juz 1-3", "grade": "good", "mistakes": 2}, headers=headers)
    assert r.status_code == 201 and r.json()["grade"] == "good"
    client.post(f"{BASE}/enrolments/{enid}/records", json={"sabaq": "Juz 5 p.5", "grade": "excellent"}, headers=headers)
    recs = client.get(f"{BASE}/enrolments/{enid}/records", headers=headers).json()
    assert len(recs) == 2

    # advance progress + complete
    upd = client.patch(f"{BASE}/enrolments/{enid}", json={"current_juz": 6, "status": "completed"}, headers=headers).json()
    assert upd["current_juz"] == 6 and upd["status"] == "completed"
    assert len(client.get(f"{BASE}/enrolments?status=active", headers=headers).json()) == 1

    # validation: juz out of range
    assert client.post(f"{BASE}/enrolments", json={"halqa_id": hid, "student_id": s2["id"], "current_juz": 31}, headers=headers).status_code == 422


def test_hifz_is_admin_only(client):
    headers = auth_headers(onboard_and_login_admin(client))
    klass = _class(client, headers)
    _student(client, headers, klass["id"], "pupil@greenwood.example.com")
    student = auth_headers(login(client, "greenwood", "pupil@greenwood.example.com", "Password123!"))
    assert client.get(f"{BASE}/halqas", headers=student).status_code == 403


def test_hifz_donors_donations_sponsorships(client):
    headers = auth_headers(onboard_and_login_admin(client))
    klass = _class(client, headers)
    student = _student(client, headers, klass["id"], "sponsored@greenwood.example.com")

    donor = client.post(f"{BASE}/donors", json={"name": "Haji Sahab", "phone": "0300"}, headers=headers)
    assert donor.status_code == 201, donor.text
    did = donor.json()["id"]
    assert donor.json()["total_donated"] == 0 and donor.json()["active_sponsorships"] == 0

    # two donations
    client.post(f"{BASE}/donations", json={"donor_id": did, "amount": 50000, "purpose": "Zakat"}, headers=headers)
    client.post(f"{BASE}/donations", json={"donor_id": did, "amount": 25000}, headers=headers)
    donations = client.get(f"{BASE}/donations", headers=headers).json()
    assert len(donations) == 2 and donations[0]["donor_name"] == "Haji Sahab"

    # donor total now 75000
    donors = client.get(f"{BASE}/donors", headers=headers).json()
    assert donors[0]["total_donated"] == 75000

    # sponsor the student
    sp = client.post(f"{BASE}/sponsorships", json={"donor_id": did, "student_id": student["id"], "monthly_amount": 5000}, headers=headers)
    assert sp.status_code == 201 and sp.json()["student_name"] == "Sponsored" and sp.json()["status"] == "active"
    assert client.get(f"{BASE}/donors", headers=headers).json()[0]["active_sponsorships"] == 1

    # end the sponsorship
    ended = client.patch(f"{BASE}/sponsorships/{sp.json()['id']}", json={"status": "ended"}, headers=headers).json()
    assert ended["status"] == "ended"
    assert len(client.get(f"{BASE}/sponsorships?status=active", headers=headers).json()) == 0

    # validation: donation amount must be positive
    assert client.post(f"{BASE}/donations", json={"donor_id": did, "amount": 0}, headers=headers).status_code == 422
