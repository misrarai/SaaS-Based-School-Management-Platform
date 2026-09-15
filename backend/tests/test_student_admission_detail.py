from tests.conftest import auth_headers, onboard_and_login_admin


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_register_student_with_full_admission_detail(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    payload = {
        "full_name": "Sam Student",
        "email": "sam@greenwood.example.com",
        "password": "Password123!",
        "class_grade_id": class_grade["id"],
        "admission_detail": {
            "father_name": "Ahmad Ali",
            "father_cnic": "3520212345671",
            "father_mobile": "03001234567",
            "father_qualification": "MSc",
            "father_occupation": "Engineer",
            "guardian_mobile": "03007654321",
            "whatsapp_number": "03001234567",
            "category": "Regular",
            "student_cnic": "3520299999999",
            "caste": "Rajput",
            "gender": "male",
            "current_address": "123 Main St",
            "mother_name": "Ayesha Ali",
            "mother_cnic": "3520211111111",
            "mother_mobile": "03009999999",
            "mother_qualification": "BA",
            "guardian_relation": "Father",
            "emergency_relation": "Uncle",
            "emergency_contact_name": "Bilal Ali",
            "emergency_phone": "0429999999",
            "emergency_mobile": "03008888888",
            "emergency_address": "456 Side St",
            "utm_source": "Referral",
            "admission_form_number": "AF-001",
            "register_serial_no": "RS-001",
            "previous_class": "Grade 4",
            "previous_school": "Old School",
            "region": "Punjab",
            "blood_group": "O+",
            "student_mobile": "03001112223",
            "birth_place": "Lahore",
            "religion": "Islam",
            "nationality": "Pakistani",
            "discount_amount": 500,
        },
    }
    response = client.post("/api/v1/students", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    body = response.json()
    detail = body["admission_detail"]
    assert detail["father_name"] == "Ahmad Ali"
    assert detail["mother_name"] == "Ayesha Ali"
    assert detail["blood_group"] == "O+"
    assert float(detail["discount_amount"]) == 500.0

    # Family should have been auto-created from father info since no family_id was given
    assert body["family_id"] is not None


def test_get_student_returns_admission_detail(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    create_resp = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
            "admission_detail": {"father_name": "Ahmad Ali", "gender": "male"},
        },
        headers=headers,
    )
    student_id = create_resp.json()["id"]

    get_resp = client.get(f"/api/v1/students/{student_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["admission_detail"]["gender"] == "male"


def test_register_student_without_admission_detail_still_works(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)

    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["admission_detail"] is None
    assert response.json()["family_id"] is None


def test_next_admission_number_preview(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.get("/api/v1/students/next-admission-number", headers=headers)
    assert response.status_code == 200
    assert response.json()["next_admission_number"] == "1"

    class_grade = create_class(client, headers)
    client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": class_grade["id"],
        },
        headers=headers,
    )

    response2 = client.get("/api/v1/students/next-admission-number", headers=headers)
    assert response2.json()["next_admission_number"] == "2"


def test_next_family_number_preview(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)

    response = client.get("/api/v1/families/next-number", headers=headers)
    assert response.status_code == 200
    assert response.json()["next_family_number"] == "1"
