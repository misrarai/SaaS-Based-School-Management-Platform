from tests.conftest import auth_headers, login, onboard_and_login_admin

BASE = "/api/v1/holidays"


def test_holiday_crud_and_year_filter(client):
    headers = auth_headers(onboard_and_login_admin(client))
    r = client.post(BASE, json={"name": "Eid ul Fitr", "from_date": "2026-03-20", "to_date": "2026-03-23", "holiday_type": "public"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["days"] == 4
    client.post(BASE, json={"name": "Summer Break", "from_date": "2026-06-01", "to_date": "2026-07-31", "holiday_type": "school"}, headers=headers)
    client.post(BASE, json={"name": "Independence Day", "from_date": "2027-08-14"}, headers=headers)

    assert len(client.get(f"{BASE}?year=2026", headers=headers).json()) == 2
    assert len(client.get(f"{BASE}?year=2027", headers=headers).json()) == 1
    # single-day default + validation
    one = client.post(BASE, json={"name": "Quaid Day", "from_date": "2026-12-25"}, headers=headers).json()
    assert one["days"] == 1
    assert client.post(BASE, json={"name": "bad", "from_date": "2026-05-10", "to_date": "2026-05-01"}, headers=headers).status_code == 422


def test_holiday_mutations_admin_only_but_list_open(client):
    headers = auth_headers(onboard_and_login_admin(client))
    klass = client.post("/api/v1/classes", json={"name": "G1", "level_order": 1, "academic_year": "2026"}, headers=headers).json()
    client.post("/api/v1/students", json={"full_name": "P Q", "email": "pq@greenwood.example.com", "password": "Password123!", "class_grade_id": klass["id"]}, headers=headers)
    student = auth_headers(login(client, "greenwood", "pq@greenwood.example.com", "Password123!"))
    # students CAN view the calendar
    assert client.get(BASE, headers=student).status_code == 200
    # but cannot create
    assert client.post(BASE, json={"name": "x", "from_date": "2026-01-01"}, headers=student).status_code == 403
