from datetime import date, timedelta

from tests.conftest import auth_headers, login, onboard_and_login_admin

API = "/api/v1/library"


def _class(client, headers):
    r = client.post(
        "/api/v1/classes", json={"name": "Grade 5", "level_order": 5, "academic_year": "2026-2027"}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


def _student(client, headers, class_id, email):
    r = client.post(
        "/api/v1/students",
        json={"full_name": email.split("@")[0].title(), "email": email, "password": "Password123!", "class_grade_id": class_id},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _teacher(client, headers, email="tom@greenwood.example.com"):
    r = client.post(
        "/api/v1/teachers", json={"full_name": "Tom Teacher", "email": email, "password": "Password123!"}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


def _book(client, headers, title="Clean Code", copies=1, **extra):
    r = client.post(f"{API}/books", json={"title": title, "author": extra.pop("author", "Robert Martin"), "copies": copies, **extra}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _member(client, headers, **ref):
    r = client.post(f"{API}/members", json=ref, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _setup(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    cls = _class(client, headers)
    student = _student(client, headers, cls["id"], "sam@greenwood.example.com")
    member = _member(client, headers, member_type="student", student_id=student["id"])
    return headers, cls, student, member


def test_catalogue_categories_copies_and_search(client):
    headers, *_ = _setup(client)
    cat = client.post(f"{API}/categories", json={"name": "Programming"}, headers=headers).json()
    dup = client.post(f"{API}/categories", json={"name": "programming"}, headers=headers)
    assert dup.status_code == 409

    book = _book(client, headers, isbn="9780132350884", category_id=cat["id"], copies=2, rack_location="R1-S2")
    assert book["total_copies"] == 2 and book["available_copies"] == 2
    assert [c["accession_number"] for c in book["copies"]] == ["1", "2"]
    _book(client, headers, title="Biology Basics", copies=0, author="Jane Doe")

    extra = client.post(f"{API}/books/{book['id']}/copies", json={"accession_number": "A-100", "barcode": "BC1"}, headers=headers)
    assert extra.status_code == 201
    clash = client.post(f"{API}/books/{book['id']}/copies", json={"accession_number": "A-100"}, headers=headers)
    assert clash.status_code == 409

    for q in ("clean", "martin", "978013", "programming"):
        res = client.get(f"{API}/books", params={"q": q}, headers=headers).json()
        assert len(res) == 1 and res[0]["available_copies"] == 3, q
    assert res[0]["category_name"] == "Programming"
    assert len(client.get(f"{API}/books", params={"available_only": True}, headers=headers).json()) == 1
    assert client.get(f"{API}/categories", headers=headers).json()[0]["book_count"] == 1
    assert client.delete(f"{API}/categories/{cat['id']}", headers=headers).status_code == 409


def test_issue_return_with_late_fine_and_collection(client):
    headers, _, _, member = _setup(client)
    client.put(f"{API}/settings", json={"fine_per_day": 10, "student_loan_days": 7}, headers=headers)
    book = _book(client, headers)
    copy = book["copies"][0]

    issued_on = date.today() - timedelta(days=12)
    r = client.post(
        f"{API}/issues",
        json={"member_id": member["id"], "copy_identifier": copy["accession_number"], "issued_on": issued_on.isoformat()},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    issue = r.json()
    assert issue["due_date"] == (issued_on + timedelta(days=7)).isoformat()
    assert issue["is_overdue"] and issue["days_overdue"] == 5
    assert issue["fine_amount"] == 50 and issue["fine_status"] == "accruing"

    again = client.post(f"{API}/issues", json={"member_id": member["id"], "copy_id": copy["id"]}, headers=headers)
    assert again.status_code == 409

    overdue = client.get(f"{API}/reports/overdue", headers=headers).json()
    assert len(overdue) == 1
    assert len(client.get(f"{API}/reports/issued", headers=headers).json()) == 1
    assert client.post(f"{API}/issues/{issue['id']}/renew", json={}, headers=headers).status_code == 409

    ret = client.post(f"{API}/returns", json={"copy_identifier": "1", "condition": "good"}, headers=headers)
    assert ret.status_code == 200, ret.text
    assert ret.json()["status"] == "returned" and ret.json()["fine_amount"] == 50
    assert ret.json()["fine_status"] == "unpaid"
    assert client.get(f"{API}/books/{book['id']}", headers=headers).json()["available_copies"] == 1

    report = client.get(f"{API}/reports/fines", headers=headers).json()
    assert report["total_outstanding"] == 50 and report["total_collected"] == 0

    paid = client.post(f"{API}/issues/{issue['id']}/fine", json={"action": "paid"}, headers=headers)
    assert paid.json()["fine_status"] == "paid"
    assert client.post(f"{API}/issues/{issue['id']}/fine", json={"action": "waived"}, headers=headers).status_code == 409
    report = client.get(f"{API}/reports/fines", headers=headers).json()
    assert report["total_collected"] == 50 and report["total_outstanding"] == 0

    most = client.get(f"{API}/reports/most-issued", headers=headers).json()
    assert most[0]["title"] == "Clean Code" and most[0]["issue_count"] == 1


def test_borrow_limit_renewal_and_lost_copy(client):
    headers, _, _, member = _setup(client)
    client.put(f"{API}/settings", json={"student_max_books": 1, "max_renewals": 1}, headers=headers)
    b1 = _book(client, headers, title="Book One", price=300)
    b2 = _book(client, headers, title="Book Two")

    issue = client.post(f"{API}/issues", json={"member_id": member["id"], "copy_id": b1["copies"][0]["id"]}, headers=headers).json()
    limit = client.post(f"{API}/issues", json={"member_id": member["id"], "copy_id": b2["copies"][0]["id"]}, headers=headers)
    assert limit.status_code == 409 and "limit" in limit.json()["detail"]

    renewed = client.post(f"{API}/issues/{issue['id']}/renew", json={}, headers=headers)
    assert renewed.status_code == 200 and renewed.json()["renewals_count"] == 1
    assert renewed.json()["due_date"] > issue["due_date"]
    assert client.post(f"{API}/issues/{issue['id']}/renew", json={}, headers=headers).status_code == 409

    lost = client.post(f"{API}/issues/{issue['id']}/return", json={"condition": "lost"}, headers=headers).json()
    assert lost["status"] == "lost" and lost["fine_amount"] == 300
    detail = client.get(f"{API}/books/{b1['id']}", headers=headers).json()
    assert detail["lost_copies"] == 1 and detail["available_copies"] == 0


def test_reservation_queue_becomes_ready_on_return(client):
    headers, cls, student, member = _setup(client)
    other = _student(client, headers, cls["id"], "zoe@greenwood.example.com")
    book = _book(client, headers)
    issue = client.post(f"{API}/issues", json={"member_id": member["id"], "copy_id": book["copies"][0]["id"]}, headers=headers).json()

    zoe_tokens = login(client, "greenwood", "zoe@greenwood.example.com", "Password123!")
    zoe = auth_headers(zoe_tokens)
    res = client.post(f"{API}/me/reservations", json={"book_id": book["id"]}, headers=zoe)
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "pending" and res.json()["queue_position"] == 1
    assert client.post(f"{API}/me/reservations", json={"book_id": book["id"]}, headers=zoe).status_code == 409

    # Sam (holder) cannot renew while someone waits
    sam = auth_headers(login(client, "greenwood", "sam@greenwood.example.com", "Password123!"))
    assert client.post(f"{API}/me/issues/{issue['id']}/renew", headers=sam).status_code == 409

    client.post(f"{API}/issues/{issue['id']}/return", json={}, headers=headers)
    active = client.get(f"{API}/reservations", headers=headers).json()
    assert active[0]["status"] == "ready" and active[0]["accession_number"] == "1"

    # Held copy cannot go to someone else
    blocked = client.post(f"{API}/issues", json={"member_id": member["id"], "copy_id": book["copies"][0]["id"]}, headers=headers)
    assert blocked.status_code == 409

    zoe_member = client.get(f"{API}/me", headers=zoe).json()["member"]
    assert zoe_member["card_number"].startswith("LIB-")
    ok = client.post(f"{API}/issues", json={"member_id": zoe_member["id"], "copy_id": book["copies"][0]["id"]}, headers=headers)
    assert ok.status_code == 201, ok.text
    mine = client.get(f"{API}/me", headers=zoe).json()
    assert mine["reservations"][0]["status"] == "fulfilled"
    assert len(mine["issues"]) == 1
    assert other["id"] == zoe_member["student_id"]


def test_reservation_rejected_when_copy_available_and_cancel(client):
    headers, cls, student, member = _setup(client)
    book = _book(client, headers)
    sam = auth_headers(login(client, "greenwood", "sam@greenwood.example.com", "Password123!"))
    assert client.post(f"{API}/me/reservations", json={"book_id": book["id"]}, headers=sam).status_code == 409

    _student(client, headers, cls["id"], "zoe@greenwood.example.com")
    zoe_member = client.get(f"{API}/members", headers=headers).json()
    assert len(zoe_member) == 1  # zoe not yet a member
    client.post(f"{API}/issues", json={"member_id": member["id"], "copy_id": book["copies"][0]["id"]}, headers=headers)
    res = client.post(f"{API}/me/reservations", json={"book_id": book["id"]}, headers=sam)
    assert res.status_code == 409  # already holds it
    zoe = auth_headers(login(client, "greenwood", "zoe@greenwood.example.com", "Password123!"))
    res = client.post(f"{API}/me/reservations", json={"book_id": book["id"]}, headers=zoe).json()
    # Sam cannot cancel Zoe's reservation
    assert client.post(f"{API}/reservations/{res['id']}/cancel", headers=sam).status_code == 404
    cancelled = client.post(f"{API}/reservations/{res['id']}/cancel", headers=zoe)
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"


def test_student_teacher_parent_portals(client):
    headers, cls, student, member = _setup(client)
    client.post(
        f"/api/v1/students/{student['id']}/parents",
        json={"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    teacher = _teacher(client, headers)
    t_member = _member(client, headers, member_type="teacher", teacher_id=teacher["id"])
    assert t_member["full_name"] == "Tom Teacher"

    book = _book(client, headers, copies=2)
    client.post(f"{API}/issues", json={"member_id": member["id"], "copy_id": book["copies"][0]["id"]}, headers=headers)
    client.post(f"{API}/issues", json={"member_id": t_member["id"], "copy_id": book["copies"][1]["id"]}, headers=headers)

    sam = auth_headers(login(client, "greenwood", "sam@greenwood.example.com", "Password123!"))
    me = client.get(f"{API}/me", headers=sam).json()
    assert len(me["issues"]) == 1 and me["member"]["id"] == member["id"]
    assert client.get(f"{API}/books", headers=sam).status_code == 200
    assert client.get(f"{API}/issues", headers=sam).status_code == 403
    assert client.post(f"{API}/books", json={"title": "X"}, headers=sam).status_code == 403

    tom = auth_headers(login(client, "greenwood", "tom@greenwood.example.com", "Password123!"))
    assert len(client.get(f"{API}/me", headers=tom).json()["issues"]) == 1

    parent = auth_headers(login(client, "greenwood", "parent@greenwood.example.com", "Password123!"))
    children = client.get(f"{API}/children", headers=parent).json()
    assert len(children) == 1 and children[0]["student_id"] == student["id"]
    assert len(children[0]["issues"]) == 1
    assert client.get(f"{API}/me", headers=parent).status_code == 403

    card = client.get(f"{API}/members/{member['id']}/card", headers=headers)
    assert card.status_code == 200 and card.content.startswith(b"%PDF")


def test_library_is_tenant_isolated(client):
    headers_a, _, _, member = _setup(client)
    book = _book(client, headers_a)
    headers_b = auth_headers(onboard_and_login_admin(client, slug="riverside"))
    assert client.get(f"{API}/books/{book['id']}", headers=headers_b).status_code == 404
    assert client.get(f"{API}/books", headers=headers_b).json() == []
    r = client.post(f"{API}/issues", json={"member_id": member["id"], "copy_id": book["copies"][0]["id"]}, headers=headers_b)
    assert r.status_code == 404
    # copies of school A don't block the same accession number in school B
    b2 = _book(client, headers_b)
    assert b2["copies"][0]["accession_number"] == "1"
