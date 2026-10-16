from tests.conftest import auth_headers, onboard_and_login_admin

BASE = "/api/v1/payroll"
# A past 30-day month so attendance marking is always allowed.
MONTH, YEAR = 9, 2026


def _teacher(client, headers, email="tom@greenwood.example.com", name="Tom Teacher"):
    r = client.post("/api/v1/teachers", json={"full_name": name, "email": email, "password": "Password123!"},
                    headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _staff(client, headers, name="Sara Staff"):
    r = client.post("/api/v1/staff", json={"full_name": name, "designation": "Accountant"}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _login(client, email, slug="greenwood"):
    r = client.post("/api/v1/auth/login", json={"tenant_slug": slug, "email": email, "password": "Password123!"})
    assert r.status_code == 200, r.text
    return auth_headers(r.json())


def _structure(client, headers, etype, eid, basic=30000, allowances=None, deductions=None):
    r = client.post(
        f"{BASE}/salary-structures",
        json={
            "employee_type": etype,
            "employee_id": eid,
            "basic_salary": basic,
            "allowances": allowances or [],
            "deductions": deductions or [],
            "effective_from": "2026-01-01",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _leave_type(client, headers, name):
    types = client.get(f"{BASE}/leave-types", headers=headers).json()
    return next(t for t in types if t["name"] == name)


def _setup(client):
    headers = auth_headers(onboard_and_login_admin(client))
    teacher = _teacher(client, headers)
    staff = _staff(client, headers)
    return headers, teacher, staff


# --- departments / designations / profiles ---


def test_departments_designations_and_profile(client):
    headers, teacher, staff = _setup(client)
    dept = client.post(f"{BASE}/departments", json={"name": "Science"}, headers=headers)
    assert dept.status_code == 201
    dup = client.post(f"{BASE}/departments", json={"name": "science"}, headers=headers)
    assert dup.status_code == 409
    desig = client.post(f"{BASE}/designations", json={"name": "Senior Teacher", "department_id": dept.json()["id"]},
                        headers=headers)
    assert desig.status_code == 201

    profile = client.put(
        f"{BASE}/employees/teacher/{teacher['id']}/profile",
        json={
            "cnic": "35202-1234567-1", "gender": "male", "department_id": dept.json()["id"],
            "designation_id": desig.json()["id"], "employment_type": "contract",
            "contract_start": "2026-01-01", "contract_end": "2026-12-31", "bank_name": "HBL",
            "bank_account_no": "0001", "emergency_contact_name": "Jane", "emergency_contact_phone": "0300",
        },
        headers=headers,
    )
    assert profile.status_code == 200, profile.text
    assert profile.json()["employment_type"] == "contract"

    employees = client.get(f"{BASE}/employees", headers=headers).json()
    assert {e["employee_type"] for e in employees} == {"teacher", "staff"}
    tom = next(e for e in employees if e["employee_type"] == "teacher")
    assert tom["department_name"] == "Science"
    assert tom["designation_name"] == "Senior Teacher"
    assert tom["profile"]["cnic"] == "35202-1234567-1"

    # in-use department cannot be deleted
    assert client.delete(f"{BASE}/departments/{dept.json()['id']}", headers=headers).status_code == 409

    bad = client.put(f"{BASE}/employees/teacher/{teacher['id']}/profile",
                     json={"contract_start": "2026-05-01", "contract_end": "2026-01-01"}, headers=headers)
    assert bad.status_code == 422


def test_teacher_cannot_access_admin_hr_endpoints(client):
    headers, teacher, staff = _setup(client)
    teacher_headers = _login(client, "tom@greenwood.example.com")
    assert client.get(f"{BASE}/employees", headers=teacher_headers).status_code == 403
    assert client.post(f"{BASE}/runs", json={"period_month": MONTH, "period_year": YEAR},
                       headers=teacher_headers).status_code == 403
    assert client.get(f"{BASE}/leaves", headers=teacher_headers).status_code == 403


# --- leaves ---


def test_teacher_applies_admin_approves_marks_attendance_and_balance(client):
    headers, teacher, staff = _setup(client)
    teacher_headers = _login(client, "tom@greenwood.example.com")
    casual = _leave_type(client, teacher_headers, "Casual")
    assert casual["yearly_quota"] == 10

    applied = client.post(
        f"{BASE}/my/leaves",
        json={"leave_type_id": casual["id"], "from_date": "2026-09-10", "to_date": "2026-09-12", "reason": "Family"},
        headers=teacher_headers,
    )
    assert applied.status_code == 201, applied.text
    assert applied.json()["days"] == 3
    assert applied.json()["status"] == "pending"

    overlap = client.post(
        f"{BASE}/my/leaves",
        json={"leave_type_id": casual["id"], "from_date": "2026-09-12", "to_date": "2026-09-13"},
        headers=teacher_headers,
    )
    assert overlap.status_code == 409

    balances = client.get(f"{BASE}/my/leave-balances?year=2026", headers=teacher_headers).json()
    casual_bal = next(b for b in balances if b["leave_type_name"] == "Casual")
    assert casual_bal["pending"] == 3 and casual_bal["used"] == 0

    approved = client.post(f"{BASE}/leaves/{applied.json()['id']}/approve", json={"note": "OK"}, headers=headers)
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["approver_name"] == "Alice Admin"
    assert client.post(f"{BASE}/leaves/{applied.json()['id']}/approve", headers=headers).status_code == 409

    records = client.get(
        "/api/v1/attendance/teachers",
        params={"teacher_id": teacher["id"], "date_from": "2026-09-01", "date_to": "2026-09-30"},
        headers=headers,
    ).json()
    leave_dates = sorted(r["attendance_date"] for r in records if r["status"] == "leave")
    assert leave_dates == ["2026-09-10", "2026-09-11", "2026-09-12"]

    balances = client.get(f"{BASE}/my/leave-balances?year=2026", headers=teacher_headers).json()
    casual_bal = next(b for b in balances if b["leave_type_name"] == "Casual")
    assert casual_bal["used"] == 3 and casual_bal["remaining"] == 7

    history = client.get(f"{BASE}/my/leaves", headers=teacher_headers).json()
    assert len(history) == 1


def test_quota_enforced_and_reject_and_cancel(client):
    headers, teacher, staff = _setup(client)
    teacher_headers = _login(client, "tom@greenwood.example.com")
    sick = _leave_type(client, headers, "Sick")  # quota 8
    too_many = client.post(
        f"{BASE}/my/leaves",
        json={"leave_type_id": sick["id"], "from_date": "2026-03-01", "to_date": "2026-03-09"},
        headers=teacher_headers,
    )
    assert too_many.status_code == 409

    req = client.post(
        f"{BASE}/my/leaves",
        json={"leave_type_id": sick["id"], "from_date": "2026-03-01", "to_date": "2026-03-02"},
        headers=teacher_headers,
    ).json()
    rejected = client.post(f"{BASE}/leaves/{req['id']}/reject", json={"note": "Exams week"}, headers=headers)
    assert rejected.json()["status"] == "rejected"

    req2 = client.post(
        f"{BASE}/my/leaves",
        json={"leave_type_id": sick["id"], "from_date": "2026-03-01", "to_date": "2026-03-02"},
        headers=teacher_headers,
    ).json()
    cancelled = client.post(f"{BASE}/my/leaves/{req2['id']}/cancel", headers=teacher_headers)
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"

    # another teacher cannot cancel someone else's request
    _teacher(client, headers, email="ann@greenwood.example.com", name="Ann Teacher")
    ann_headers = _login(client, "ann@greenwood.example.com")
    req3 = client.post(
        f"{BASE}/my/leaves",
        json={"leave_type_id": sick["id"], "from_date": "2026-04-01", "to_date": "2026-04-01"},
        headers=teacher_headers,
    ).json()
    assert client.post(f"{BASE}/my/leaves/{req3['id']}/cancel", headers=ann_headers).status_code == 404


def test_admin_applies_leave_for_staff_marks_staff_attendance(client):
    headers, teacher, staff = _setup(client)
    annual = _leave_type(client, headers, "Annual")
    req = client.post(
        f"{BASE}/leaves",
        json={"employee_type": "staff", "employee_id": staff["id"], "leave_type_id": annual["id"],
              "from_date": "2026-09-01", "to_date": "2026-09-02"},
        headers=headers,
    )
    assert req.status_code == 201, req.text
    assert req.json()["employee_name"] == "Sara Staff"
    client.post(f"{BASE}/leaves/{req.json()['id']}/approve", headers=headers)
    records = client.get(
        "/api/v1/attendance/staff",
        params={"staff_id": staff["id"], "date_from": "2026-09-01", "date_to": "2026-09-30"},
        headers=headers,
    ).json()
    assert sorted(r["attendance_date"] for r in records if r["status"] == "leave") == ["2026-09-01", "2026-09-02"]

    pending = client.get(f"{BASE}/leaves?status=approved", headers=headers).json()
    assert len(pending) == 1


# --- payroll ---


def test_payroll_run_full_flow(client):
    headers, teacher, staff = _setup(client)
    # teacher: gross 30000 + 3000 + 2000 - deductions 1500 ; 30-day month -> per day 1166.67
    _structure(
        client, headers, "teacher", teacher["id"], basic=30000,
        allowances=[{"type": "house_rent", "name": "House Rent", "amount": 3000},
                    {"type": "medical", "name": "Medical", "amount": 2000}],
        deductions=[{"type": "provident_fund", "name": "Provident Fund", "amount": 1500}],
    )
    _structure(client, headers, "staff", staff["id"], basic=15000)

    # teacher: 1 absent + 1 half day ; 2 days unpaid leave
    for d, s in (("2026-09-03", "absent"), ("2026-09-04", "half_day"), ("2026-09-05", "present")):
        r = client.post("/api/v1/attendance/teachers/mark",
                        json={"teacher_id": teacher["id"], "attendance_date": d, "status": s}, headers=headers)
        assert r.status_code == 200, r.text
    unpaid = _leave_type(client, headers, "Unpaid")
    leave = client.post(
        f"{BASE}/leaves",
        json={"employee_type": "teacher", "employee_id": teacher["id"], "leave_type_id": unpaid["id"],
              "from_date": "2026-09-20", "to_date": "2026-09-21"},
        headers=headers,
    ).json()
    client.post(f"{BASE}/leaves/{leave['id']}/approve", headers=headers)

    # staff: advance of 5000 at 2000/month
    adv = client.post(
        f"{BASE}/advances",
        json={"employee_type": "staff", "employee_id": staff["id"], "amount": 5000, "monthly_installment": 2000,
              "issued_on": "2026-08-15"},
        headers=headers,
    )
    assert adv.status_code == 201, adv.text

    run = client.post(f"{BASE}/runs", json={"period_month": MONTH, "period_year": YEAR}, headers=headers)
    assert run.status_code == 201, run.text
    run = run.json()
    assert run["employee_count"] == 2 and run["status"] == "draft"

    detail = client.get(f"{BASE}/runs/{run['id']}", headers=headers).json()
    tslip = next(p for p in detail["payslips"] if p["employee_type"] == "teacher")
    sslip = next(p for p in detail["payslips"] if p["employee_type"] == "staff")

    assert tslip["gross_salary"] == 35000
    assert tslip["working_days"] == 30
    assert tslip["per_day_rate"] == 1166.67
    assert tslip["absent_days"] == 1.5
    assert tslip["unpaid_leave_days"] == 2
    assert tslip["absence_deduction"] == round(3.5 * 1166.67, 2)
    assert tslip["structure_deductions"] == 1500
    assert tslip["net_pay"] == round(35000 - 1500 - 3.5 * 1166.67, 2)

    assert sslip["advance_deduction"] == 2000
    assert sslip["net_pay"] == 13000

    # adjustments on draft
    adj = client.post(f"{BASE}/payslips/{sslip['id']}/adjustments",
                      json={"kind": "bonus", "amount": 1000, "note": "Eid"}, headers=headers)
    assert adj.status_code == 201
    adj = client.post(f"{BASE}/payslips/{sslip['id']}/adjustments",
                      json={"kind": "fine", "amount": 300}, headers=headers).json()
    assert adj["net_pay"] == 13000 + 1000 - 300
    fine_id = next(a["id"] for a in adj["adjustments"] if a["kind"] == "fine")
    removed = client.delete(f"{BASE}/payslips/{sslip['id']}/adjustments/{fine_id}", headers=headers).json()
    assert removed["net_pay"] == 14000

    # regenerate draft keeps adjustments and doesn't double-count the advance
    client.post(f"{BASE}/runs", json={"period_month": MONTH, "period_year": YEAR}, headers=headers)
    sslip2 = client.get(f"{BASE}/payslips/{sslip['id']}", headers=headers).json()
    assert sslip2["net_pay"] == 14000 and sslip2["advance_deduction"] == 2000
    advances = client.get(f"{BASE}/advances", headers=headers).json()
    assert advances[0]["amount_repaid"] == 2000 and advances[0]["balance"] == 3000

    # PDFs / xlsx
    pdf = client.get(f"{BASE}/payslips/{tslip['id']}/pdf", headers=headers)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    sheet = client.get(f"{BASE}/runs/{run['id']}/sheet.pdf", headers=headers)
    assert sheet.status_code == 200 and sheet.content.startswith(b"%PDF")
    xlsx = client.get(f"{BASE}/runs/{run['id']}/sheet.xlsx", headers=headers)
    assert xlsx.status_code == 200 and xlsx.content[:2] == b"PK"

    # teacher can't see draft payslips
    teacher_headers = _login(client, "tom@greenwood.example.com")
    assert client.get(f"{BASE}/my/payslips", headers=teacher_headers).json() == []
    assert client.get(f"{BASE}/my/payslips/{tslip['id']}/pdf", headers=teacher_headers).status_code == 404

    # state machine
    assert client.post(f"{BASE}/runs/{run['id']}/mark-paid", headers=headers).status_code == 409
    approved = client.post(f"{BASE}/runs/{run['id']}/approve", headers=headers)
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    assert client.post(f"{BASE}/runs/{run['id']}/approve", headers=headers).status_code == 409
    assert client.post(f"{BASE}/runs", json={"period_month": MONTH, "period_year": YEAR},
                       headers=headers).status_code == 409
    assert client.post(f"{BASE}/payslips/{sslip['id']}/adjustments", json={"kind": "bonus", "amount": 5},
                       headers=headers).status_code == 409
    assert client.delete(f"{BASE}/runs/{run['id']}", headers=headers).status_code == 409
    paid = client.post(f"{BASE}/runs/{run['id']}/mark-paid", headers=headers)
    assert paid.status_code == 200 and paid.json()["status"] == "paid" and paid.json()["paid_at"]

    mine = client.get(f"{BASE}/my/payslips", headers=teacher_headers).json()
    assert len(mine) == 1 and mine[0]["status"] == "paid"
    my_pdf = client.get(f"{BASE}/my/payslips/{tslip['id']}/pdf", headers=teacher_headers)
    assert my_pdf.status_code == 200 and my_pdf.content.startswith(b"%PDF")
    # teacher can't fetch the staff member's slip
    assert client.get(f"{BASE}/my/payslips/{sslip['id']}/pdf", headers=teacher_headers).status_code == 404

    # next month continues the advance until repaid: 2000 + 1000 remaining
    oct_run = client.post(f"{BASE}/runs", json={"period_month": 10, "period_year": YEAR}, headers=headers).json()
    oct_detail = client.get(f"{BASE}/runs/{oct_run['id']}", headers=headers).json()
    assert next(p for p in oct_detail["payslips"] if p["employee_type"] == "staff")["advance_deduction"] == 2000
    nov_run = client.post(f"{BASE}/runs", json={"period_month": 11, "period_year": YEAR}, headers=headers).json()
    nov_detail = client.get(f"{BASE}/runs/{nov_run['id']}", headers=headers).json()
    assert next(p for p in nov_detail["payslips"] if p["employee_type"] == "staff")["advance_deduction"] == 1000
    adv_after = client.get(f"{BASE}/advances", headers=headers).json()[0]
    assert adv_after["status"] == "repaid" and adv_after["balance"] == 0
    assert client.delete(f"{BASE}/advances/{adv_after['id']}", headers=headers).status_code == 409

    # deleting a draft run releases its advance repayment
    assert client.delete(f"{BASE}/runs/{nov_run['id']}", headers=headers).status_code == 204
    adv_after = client.get(f"{BASE}/advances", headers=headers).json()[0]
    assert adv_after["status"] == "active" and adv_after["balance"] == 1000


def test_employees_without_structure_are_skipped_and_inactive_excluded(client):
    headers, teacher, staff = _setup(client)
    _structure(client, headers, "teacher", teacher["id"])
    other = _staff(client, headers, name="Old Peon")
    _structure(client, headers, "staff", other["id"])
    client.post(f"/api/v1/staff/{other['id']}/status", json={"status": "inactive"}, headers=headers)

    run = client.post(f"{BASE}/runs", json={"period_month": MONTH, "period_year": YEAR}, headers=headers).json()
    assert run["employee_count"] == 1
    assert run["skipped_employees"] == ["Sara Staff"]


def test_salary_structure_versioning(client):
    headers, teacher, staff = _setup(client)
    _structure(client, headers, "staff", staff["id"], basic=10000)
    r = client.post(
        f"{BASE}/salary-structures",
        json={"employee_type": "staff", "employee_id": staff["id"], "basic_salary": 12000,
              "effective_from": "2026-10-01"},
        headers=headers,
    )
    assert r.status_code == 201
    structures = client.get(f"{BASE}/salary-structures",
                            params={"employee_type": "staff", "employee_id": staff["id"]}, headers=headers).json()
    assert [s["basic_salary"] for s in structures] == [12000, 10000]
    sep = client.post(f"{BASE}/runs", json={"period_month": 9, "period_year": YEAR}, headers=headers).json()
    oct_ = client.post(f"{BASE}/runs", json={"period_month": 10, "period_year": YEAR}, headers=headers).json()
    assert sep["total_net"] == 10000
    assert oct_["total_net"] == 12000


def test_payroll_isolated_per_tenant(client):
    headers, teacher, staff = _setup(client)
    _structure(client, headers, "staff", staff["id"])
    run = client.post(f"{BASE}/runs", json={"period_month": MONTH, "period_year": YEAR}, headers=headers).json()
    dept = client.post(f"{BASE}/departments", json={"name": "Admin"}, headers=headers).json()

    other_headers = auth_headers(onboard_and_login_admin(client, slug="oakridge"))
    assert client.get(f"{BASE}/runs/{run['id']}", headers=other_headers).status_code == 404
    assert client.get(f"{BASE}/runs", headers=other_headers).json() == []
    assert client.get(f"{BASE}/departments", headers=other_headers).json() == []
    assert client.delete(f"{BASE}/departments/{dept['id']}", headers=other_headers).status_code == 404
    assert client.get(f"{BASE}/employees", headers=other_headers).json() == []
    assert client.post(
        f"{BASE}/salary-structures",
        json={"employee_type": "staff", "employee_id": staff["id"], "basic_salary": 1, "effective_from": "2026-01-01"},
        headers=other_headers,
    ).status_code == 404
