from datetime import date

from tests.conftest import auth_headers, onboard_and_login_admin
from tests.test_fees import create_class, create_student
from tests.test_hr_attendance import create_staff, create_teacher


def test_dashboard_overview_tiles_receivables_and_charts(client):
    headers = auth_headers(onboard_and_login_admin(client))
    class_grade = create_class(client, headers)
    student = create_student(client, headers, class_grade["id"])
    create_teacher(client, headers)
    staff = create_staff(client, headers)
    client.post(
        "/api/v1/attendance/staff/mark",
        json={"staff_id": staff["id"], "attendance_date": date.today().isoformat(), "status": "present"},
        headers=headers,
    )
    today = date.today()
    invoice = client.post(
        "/api/v1/fees/invoices",
        json={
            "student_id": student["id"],
            "invoice_type": "admission",
            "amount_due": 5000,
            "due_date": today.isoformat(),
        },
        headers=headers,
    )
    assert invoice.status_code == 201, invoice.text

    response = client.get("/api/v1/dashboard/summary", headers=headers)
    assert response.status_code == 200, response.text
    overview = response.json()["overview"]

    assert overview["total_students_all"] == 1
    assert overview["active_staff_all"] == 2  # one teacher + one staff member
    assert overview["fee_this_month"] == 5000
    assert overview["receivable_this_month"] == 5000
    assert overview["total_receivable"] == 5000

    report = overview["receivable_report"]
    assert report["year"] == today.year
    assert len(report["months"]) == 12
    assert report["months"][today.month - 1]["amount"] == 5000
    assert report["total"] == 5000

    assert overview["hr_attendance"]["present"] == 1
    assert overview["hr_attendance"]["not_marked"] == 1
    assert overview["student_attendance"]["not_marked"] == 1
    assert {m["channel"] for m in overview["messaging_today"]} == {"whatsapp", "email"}
    assert len(overview["cash_flow"]) == len(overview["admissions"]) >= 28
