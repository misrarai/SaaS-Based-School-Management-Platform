from datetime import date, timedelta

from tests.conftest import auth_headers, login, onboard_and_login_admin

BASE = "/api/v1/transport"


def _class(client, headers):
    r = client.post(
        "/api/v1/classes", json={"name": "Grade 5", "level_order": 5, "academic_year": "2026-2027"}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


def _student(client, headers, class_id, email):
    r = client.post(
        "/api/v1/students",
        json={"full_name": "Student " + email.split("@")[0].title(), "email": email, "password": "Password123!", "class_grade_id": class_id},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _link_parent(client, headers, student_id, email="parent@greenwood.example.com"):
    r = client.post(
        f"/api/v1/students/{student_id}/parents",
        json={"full_name": "Pat Parent", "email": email, "password": "Password123!"},
        headers=headers,
    )
    assert r.status_code == 201, r.text


def _setup_route(client, headers, capacity=2, fare=3000):
    driver = client.post(
        f"{BASE}/drivers",
        json={"full_name": "Driver Dan", "phone": "03001234567", "license_number": "LIC-1"},
        headers=headers,
    )
    assert driver.status_code == 201, driver.text
    vehicle = client.post(
        f"{BASE}/vehicles",
        json={"registration_number": "LEA-123", "vehicle_type": "van", "capacity": capacity, "driver_id": driver.json()["id"]},
        headers=headers,
    )
    assert vehicle.status_code == 201, vehicle.text
    route = client.post(
        f"{BASE}/routes",
        json={
            "name": "Route A",
            "code": "R-A",
            "vehicle_id": vehicle.json()["id"],
            "start_point": "Main Gate",
            "stops": [
                {"name": "Model Town", "stop_order": 1, "pickup_time": "07:10", "drop_time": "14:20", "monthly_fare": fare},
                {"name": "Johar Town", "stop_order": 2, "pickup_time": "07:25", "monthly_fare": fare + 500},
            ],
        },
        headers=headers,
    )
    assert route.status_code == 201, route.text
    return driver.json(), vehicle.json(), route.json()


def _allocate(client, headers, student_id, route, stop_index=0):
    return client.post(
        f"{BASE}/allocations",
        json={
            "student_id": student_id,
            "route_id": route["id"],
            "stop_id": route["stops"][stop_index]["id"],
            "pickup_type": "both",
            "start_date": "2026-09-01",
        },
        headers=headers,
    )


def test_vehicle_driver_route_crud(client):
    headers = auth_headers(onboard_and_login_admin(client))
    driver, vehicle, route = _setup_route(client, headers)
    assert vehicle["driver_name"] == "Driver Dan"
    assert len(route["stops"]) == 2
    assert route["vehicle_registration"] == "LEA-123"

    dup = client.post(f"{BASE}/vehicles", json={"registration_number": "lea-123", "capacity": 10}, headers=headers)
    assert dup.status_code == 409

    stop = client.post(f"{BASE}/routes/{route['id']}/stops", json={"name": "DHA", "monthly_fare": 4000}, headers=headers)
    assert stop.status_code == 201
    upd = client.patch(f"{BASE}/stops/{stop.json()['id']}", json={"pickup_time": "07:40"}, headers=headers)
    assert upd.json()["pickup_time"] == "07:40"
    assert client.delete(f"{BASE}/stops/{stop.json()['id']}", headers=headers).status_code == 204

    assert client.delete(f"{BASE}/drivers/{driver['id']}", headers=headers).status_code == 409
    assert client.delete(f"{BASE}/vehicles/{vehicle['id']}", headers=headers).status_code == 409
    assert len(client.get(f"{BASE}/routes", headers=headers).json()) == 1


def test_allocation_capacity_and_duplicate(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cls = _class(client, headers)
    _, _, route = _setup_route(client, headers, capacity=2)
    s1 = _student(client, headers, cls["id"], "a@greenwood.example.com")
    s2 = _student(client, headers, cls["id"], "b@greenwood.example.com")
    s3 = _student(client, headers, cls["id"], "c@greenwood.example.com")

    r1 = _allocate(client, headers, s1["id"], route)
    assert r1.status_code == 201, r1.text
    assert r1.json()["monthly_fare"] == 3000
    assert _allocate(client, headers, s1["id"], route).status_code == 409  # already allocated
    assert _allocate(client, headers, s2["id"], route, 1).status_code == 201
    full = _allocate(client, headers, s3["id"], route)
    assert full.status_code == 409
    assert "full" in full.json()["detail"]

    ended = client.post(f"{BASE}/allocations/{r1.json()['id']}/end", json={"end_date": "2026-09-30"}, headers=headers)
    assert ended.status_code == 200
    assert ended.json()["status"] == "inactive"
    assert _allocate(client, headers, s3["id"], route).status_code == 201

    strength = client.get(f"{BASE}/reports/route-strength", headers=headers).json()
    assert strength[0]["student_count"] == 2


def test_generate_transport_fees_dedupes(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cls = _class(client, headers)
    _, _, route = _setup_route(client, headers, capacity=5)
    s1 = _student(client, headers, cls["id"], "a@greenwood.example.com")
    s2 = _student(client, headers, cls["id"], "b@greenwood.example.com")
    _allocate(client, headers, s1["id"], route, 0)
    _allocate(client, headers, s2["id"], route, 1)

    payload = {"period_month": 10, "period_year": 2026, "due_date": "2026-10-10"}
    first = client.post(f"{BASE}/fees/generate", json=payload, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["created_count"] == 2
    assert sorted(r["amount"] for r in first.json()["records"]) == [3000, 3500]

    second = client.post(f"{BASE}/fees/generate", json=payload, headers=headers).json()
    assert second["created_count"] == 0
    assert second["skipped_count"] == 2

    invoices = client.get("/api/v1/fees/invoices", headers=headers)
    if invoices.status_code == 200:
        transport = [i for i in invoices.json() if (i.get("notes") or "").startswith("Transport fee")]
        assert len(transport) == 2
        assert transport[0]["notes"] == "Transport fee October 2026"
        assert transport[0]["invoice_type"] == "other"

    records = client.get(f"{BASE}/fees?month=10&year=2026", headers=headers).json()
    assert len(records) == 2

    # allocation starting after the month is not billed
    nov = client.post(
        f"{BASE}/fees/generate", json={"period_month": 8, "period_year": 2026, "due_date": "2026-08-10"}, headers=headers
    ).json()
    assert nov["created_count"] == 0


def test_expiring_documents_report(client):
    headers = auth_headers(onboard_and_login_admin(client))
    soon = (date.today() + timedelta(days=10)).isoformat()
    later = (date.today() + timedelta(days=200)).isoformat()
    client.post(
        f"{BASE}/vehicles",
        json={"registration_number": "X-1", "capacity": 10, "insurance_expiry": soon, "fitness_expiry": later},
        headers=headers,
    )
    client.post(f"{BASE}/drivers", json={"full_name": "Old License", "license_expiry": soon}, headers=headers)
    rows = client.get(f"{BASE}/reports/expiring-documents", headers=headers).json()
    kinds = sorted(r["kind"] for r in rows)
    assert kinds == ["driver_license", "vehicle_insurance"]
    assert all(r["days_left"] == 10 for r in rows)


def test_parent_and_student_portal(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cls = _class(client, headers)
    _, _, route = _setup_route(client, headers)
    s1 = _student(client, headers, cls["id"], "kid@greenwood.example.com")
    other = _student(client, headers, cls["id"], "other@greenwood.example.com")
    _link_parent(client, headers, s1["id"])
    _allocate(client, headers, s1["id"], route)

    parent = auth_headers(login(client, "greenwood", "parent@greenwood.example.com", "Password123!"))
    mine = client.get(f"{BASE}/me", headers=parent)
    assert mine.status_code == 200
    info = mine.json()[0]
    assert info["route_name"] == "Route A"
    assert info["stop_name"] == "Model Town"
    assert info["pickup_time"] == "07:10"
    assert info["driver_phone"] == "03001234567"
    assert info["vehicle_registration"] == "LEA-123"

    assert client.get(f"{BASE}/students/{s1['id']}", headers=parent).status_code == 200
    assert client.get(f"{BASE}/students/{other['id']}", headers=parent).status_code == 403
    assert client.get(f"{BASE}/vehicles", headers=parent).status_code == 403

    student = auth_headers(login(client, "greenwood", "kid@greenwood.example.com", "Password123!"))
    own = client.get(f"{BASE}/me", headers=student).json()
    assert len(own) == 1 and own[0]["route_name"] == "Route A"

    other_student = auth_headers(login(client, "greenwood", "other@greenwood.example.com", "Password123!"))
    none = client.get(f"{BASE}/me", headers=other_student).json()
    assert none[0]["route_name"] is None


def test_transport_tenant_isolation(client):
    headers_a = auth_headers(onboard_and_login_admin(client, slug="greenwood"))
    _, vehicle, route = _setup_route(client, headers_a)
    headers_b = auth_headers(onboard_and_login_admin(client, slug="riverside"))
    assert client.get(f"{BASE}/vehicles/{vehicle['id']}", headers=headers_b).status_code == 404
    assert client.get(f"{BASE}/routes/{route['id']}", headers=headers_b).status_code == 404
    assert client.get(f"{BASE}/routes", headers=headers_b).json() == []
