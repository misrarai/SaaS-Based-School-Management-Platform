import io

import openpyxl

from tests.conftest import auth_headers, onboard_and_login_admin


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def build_workbook(rows: list[list]) -> bytes:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["Full Name", "Email", "Password", "Roll Number", "Father Name", "Father Mobile"])
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_download_sample_template(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.get("/api/v1/students/import/sample", headers=headers)
    assert response.status_code == 200
    assert "spreadsheet" in response.headers["content-type"]


def test_bulk_import_creates_students(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    xlsx_bytes = build_workbook(
        [
            ["Ali Student", "ali@greenwood.example.com", "Password123!", "5A-01", "Bilal Ahmad", "03001111111"],
            ["Zara Student", "zara@greenwood.example.com", "Password123!", "5A-02", "Farhan Ahmad", "03002222222"],
        ]
    )

    response = client.post(
        f"/api/v1/students/import?class_grade_id={class_grade['id']}",
        headers=headers,
        files={"file": ("students.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 2
    assert body["failed"] == []

    students = client.get("/api/v1/students?status=all", headers=headers).json()
    assert len(students) == 2


def test_bulk_import_reports_row_failures_without_aborting(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    xlsx_bytes = build_workbook(
        [
            ["Ali Student", "ali@greenwood.example.com", "Password123!", "5A-01", "Bilal Ahmad", "03001111111"],
            ["Bad Row", "", "", "", "", ""],  # missing required fields
            ["Zara Student", "zara@greenwood.example.com", "Password123!", "5A-02", "Farhan Ahmad", "03002222222"],
        ]
    )

    response = client.post(
        f"/api/v1/students/import?class_grade_id={class_grade['id']}",
        headers=headers,
        files={"file": ("students.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 2
    assert len(body["failed"]) == 1
    assert body["failed"][0]["row"] == 3


def test_bulk_import_invalid_class_rejected(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    xlsx_bytes = build_workbook([["Ali Student", "ali@greenwood.example.com", "Password123!", "", "", ""]])

    response = client.post(
        "/api/v1/students/import?class_grade_id=00000000-0000-0000-0000-000000000000",
        headers=headers,
        files={"file": ("students.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 404
