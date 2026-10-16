from tests.conftest import auth_headers, login, onboard_and_login_admin

BASE = "/api/v1/hostel"


def _class(client, headers):
    r = client.post(
        "/api/v1/classes", json={"name": "Grade 7", "level_order": 7, "academic_year": "2026-2027"}, headers=headers
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


def _hostel_with_room(client, headers, capacity=2, fee=8000):
    hostel = client.post(
        f"{BASE}/hostels",
        json={"name": "Iqbal House", "hostel_type": "boys", "warden_name": "Mr Warden", "warden_phone": "0300111"},
        headers=headers,
    )
    assert hostel.status_code == 201, hostel.text
    room = client.post(
        f"{BASE}/hostels/{hostel.json()['id']}/rooms",
        json={"room_number": "101", "floor": "Ground", "room_type": "double", "capacity": capacity, "monthly_fee": fee},
        headers=headers,
    )
    assert room.status_code == 201, room.text
    return hostel.json(), room.json()


def _allocate(client, headers, student_id, room_id, bed=None):
    body = {"student_id": student_id, "room_id": room_id, "from_date": "2026-09-01"}
    if bed:
        body["bed_label"] = bed
    return client.post(f"{BASE}/allocations", json=body, headers=headers)


def test_hostel_and_room_crud(client):
    headers = auth_headers(onboard_and_login_admin(client))
    hostel, room = _hostel_with_room(client, headers)
    assert room["available"] == 2
    dup = client.post(f"{BASE}/hostels/{hostel['id']}/rooms", json={"room_number": "101", "capacity": 3}, headers=headers)
    assert dup.status_code == 409
    upd = client.patch(f"{BASE}/rooms/{room['id']}", json={"capacity": 3}, headers=headers)
    assert upd.json()["capacity"] == 3
    listing = client.get(f"{BASE}/hostels", headers=headers).json()
    assert listing[0]["total_beds"] == 3 and listing[0]["room_count"] == 1
    assert client.delete(f"{BASE}/hostels/{hostel['id']}", headers=headers).status_code == 409
    assert client.delete(f"{BASE}/rooms/{room['id']}", headers=headers).status_code == 204
    assert client.delete(f"{BASE}/hostels/{hostel['id']}", headers=headers).status_code == 204


def test_allocation_capacity_vacate_and_occupancy(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cls = _class(client, headers)
    _, room = _hostel_with_room(client, headers, capacity=2)
    s1 = _student(client, headers, cls["id"], "a@greenwood.example.com")
    s2 = _student(client, headers, cls["id"], "b@greenwood.example.com")
    s3 = _student(client, headers, cls["id"], "c@greenwood.example.com")

    a1 = _allocate(client, headers, s1["id"], room["id"], bed="A")
    assert a1.status_code == 201, a1.text
    assert _allocate(client, headers, s1["id"], room["id"]).status_code == 409
    assert _allocate(client, headers, s2["id"], room["id"], bed="A").status_code == 409  # bed taken
    assert _allocate(client, headers, s2["id"], room["id"], bed="B").status_code == 201
    full = _allocate(client, headers, s3["id"], room["id"])
    assert full.status_code == 409 and "full" in full.json()["detail"]

    occ = client.get(f"{BASE}/reports/occupancy", headers=headers).json()
    assert occ[0]["occupied_beds"] == 2 and occ[0]["occupancy_percent"] == 100.0

    vac = client.post(f"{BASE}/allocations/{a1.json()['id']}/vacate", json={"to_date": "2026-09-30"}, headers=headers)
    assert vac.status_code == 200 and vac.json()["status"] == "vacated"
    assert client.post(f"{BASE}/allocations/{a1.json()['id']}/vacate", headers=headers).status_code == 409
    assert _allocate(client, headers, s3["id"], room["id"]).status_code == 201

    active = client.get(f"{BASE}/allocations", headers=headers).json()
    assert len(active) == 2
    everything = client.get(f"{BASE}/allocations?status=all", headers=headers).json()
    assert len(everything) == 3


def test_generate_hostel_fees_dedupes(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cls = _class(client, headers)
    _, room = _hostel_with_room(client, headers, capacity=3, fee=8000)
    s1 = _student(client, headers, cls["id"], "a@greenwood.example.com")
    _allocate(client, headers, s1["id"], room["id"])

    payload = {"period_month": 10, "period_year": 2026, "due_date": "2026-10-10"}
    first = client.post(f"{BASE}/fees/generate", json=payload, headers=headers).json()
    assert first["created_count"] == 1
    assert first["records"][0]["amount"] == 8000
    second = client.post(f"{BASE}/fees/generate", json=payload, headers=headers).json()
    assert second["created_count"] == 0 and second["skipped_count"] == 1

    invoices = client.get("/api/v1/fees/invoices", headers=headers)
    if invoices.status_code == 200:
        hostel_invoices = [i for i in invoices.json() if (i.get("notes") or "") == "Hostel fee October 2026"]
        assert len(hostel_invoices) == 1
        assert hostel_invoices[0]["invoice_type"] == "other"


def test_mess_menu_upsert(client):
    headers = auth_headers(onboard_and_login_admin(client))
    hostel, _ = _hostel_with_room(client, headers)
    r = client.put(
        f"{BASE}/mess-menu",
        json={"entries": [{"day_of_week": 0, "breakfast": "Paratha", "lunch": "Daal", "dinner": "Biryani"}]},
        headers=headers,
    )
    assert r.status_code == 200 and len(r.json()) == 1
    r = client.put(
        f"{BASE}/mess-menu",
        json={"entries": [{"day_of_week": 0, "breakfast": "Eggs"}, {"day_of_week": 1, "lunch": "Chicken"}]},
        headers=headers,
    )
    menu = r.json()
    assert len(menu) == 2 and menu[0]["breakfast"] == "Eggs"
    specific = client.put(
        f"{BASE}/mess-menu", json={"hostel_id": hostel["id"], "entries": [{"day_of_week": 2, "dinner": "Karahi"}]}, headers=headers
    )
    assert len(specific.json()) == 1
    assert len(client.get(f"{BASE}/mess-menu", headers=headers).json()) == 2


def test_outpass_flow_and_portal(client):
    headers = auth_headers(onboard_and_login_admin(client))
    cls = _class(client, headers)
    _, room = _hostel_with_room(client, headers)
    kid = _student(client, headers, cls["id"], "kid@greenwood.example.com")
    other = _student(client, headers, cls["id"], "other@greenwood.example.com")
    _link_parent(client, headers, kid["id"])
    _allocate(client, headers, kid["id"], room["id"], bed="A")
    client.put(f"{BASE}/mess-menu", json={"entries": [{"day_of_week": 4, "lunch": "Pulao"}]}, headers=headers)

    parent = auth_headers(login(client, "greenwood", "parent@greenwood.example.com", "Password123!"))
    body = {
        "student_id": kid["id"],
        "out_at": "2026-10-10T09:00:00",
        "expected_return_at": "2026-10-11T18:00:00",
        "reason": "Family wedding",
        "visitor_name": "Pat Parent",
    }
    req = client.post(f"{BASE}/outpasses", json=body, headers=parent)
    assert req.status_code == 201, req.text
    assert req.json()["status"] == "pending"
    forbidden = client.post(f"{BASE}/outpasses", json={**body, "student_id": other["id"]}, headers=parent)
    assert forbidden.status_code == 403
    assert client.post(f"{BASE}/outpasses/{req.json()['id']}/approve", headers=parent).status_code == 403

    approved = client.post(f"{BASE}/outpasses/{req.json()['id']}/approve", json={"remarks": "ok"}, headers=headers)
    assert approved.json()["status"] == "approved"
    assert approved.json()["approved_by_name"] == "Alice Admin"
    returned = client.post(
        f"{BASE}/outpasses/{req.json()['id']}/return", json={"actual_return_at": "2026-10-11T20:00:00"}, headers=headers
    )
    assert returned.json()["status"] == "returned" and returned.json()["is_late"] is True

    # outpass for a student not in the hostel is refused
    assert client.post(f"{BASE}/outpasses", json={**body, "student_id": other["id"]}, headers=headers).status_code == 409

    mine = client.get(f"{BASE}/me", headers=parent).json()
    assert mine[0]["hostel_name"] == "Iqbal House"
    assert mine[0]["room_number"] == "101" and mine[0]["bed_label"] == "A"
    assert mine[0]["mess_menu"][0]["lunch"] == "Pulao"
    assert len(mine[0]["outpasses"]) == 1
    assert len(client.get(f"{BASE}/outpasses", headers=parent).json()) == 1
    assert client.get(f"{BASE}/students/{other['id']}", headers=parent).status_code == 403

    student = auth_headers(login(client, "greenwood", "kid@greenwood.example.com", "Password123!"))
    assert client.get(f"{BASE}/me", headers=student).json()[0]["warden_phone"] == "0300111"
    assert client.get(f"{BASE}/hostels", headers=student).status_code == 403
    assert client.post(f"{BASE}/outpasses", json=body, headers=student).status_code == 403


def test_hostel_tenant_isolation(client):
    headers_a = auth_headers(onboard_and_login_admin(client, slug="greenwood"))
    hostel, room = _hostel_with_room(client, headers_a)
    headers_b = auth_headers(onboard_and_login_admin(client, slug="riverside"))
    assert client.get(f"{BASE}/hostels/{hostel['id']}", headers=headers_b).status_code == 404
    assert client.patch(f"{BASE}/rooms/{room['id']}", json={"capacity": 5}, headers=headers_b).status_code == 404
    assert client.get(f"{BASE}/hostels", headers=headers_b).json() == []
