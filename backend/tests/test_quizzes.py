from tests.conftest import auth_headers, onboard_and_login_admin


def create_class(client, headers, name="Grade 5", level_order=5):
    response = client.post(
        "/api/v1/classes",
        json={"name": name, "level_order": level_order, "academic_year": "2026-2027"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_section(client, headers, class_id, name="A"):
    response = client.post(f"/api/v1/classes/{class_id}/sections", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_subject(client, headers, class_id, name="Mathematics", code="MATH5"):
    response = client.post(f"/api/v1/classes/{class_id}/subjects", json={"name": name, "code": code}, headers=headers)
    assert response.status_code == 201
    return response.json()


def create_teacher(client, headers, email="tom@greenwood.example.com"):
    response = client.post(
        "/api/v1/teachers",
        json={"full_name": "Tom Teacher", "email": email, "password": "Password123!"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def create_student(client, headers, class_id, section_id, email="sam@greenwood.example.com"):
    response = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": email,
            "password": "Password123!",
            "class_grade_id": class_id,
            "section_id": section_id,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def schedule_teacher(client, headers, section_id, subject_id, teacher_id):
    response = client.post(
        "/api/v1/schedule/templates",
        json={
            "section_id": section_id,
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "09:45:00",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _login(client, email, password="Password123!"):
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": "greenwood", "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return auth_headers(resp.json())


def _setup(client, headers):
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    teacher = create_teacher(client, headers)
    schedule_teacher(client, headers, section["id"], subject["id"], teacher["id"])
    return class_grade, section, subject, teacher


MIXED_QUIZ_PAYLOAD = {
    "title": "Mixed Exam",
    "questions": [
        {
            "question_text": "1/2 + 1/2 = ?",
            "question_type": "mcq_single",
            "marks": 2,
            "options": [
                {"option_text": "1", "is_correct": True},
                {"option_text": "2", "is_correct": False},
            ],
        },
        {
            "question_text": "Explain why the sky is blue.",
            "question_type": "short_answer",
            "marks": 3,
            "options": [],
        },
    ],
}


QUIZ_PAYLOAD_TEMPLATE = {
    "title": "Fractions Quiz",
    "description": "Basic fractions",
    "time_limit_minutes": 10,
    "questions": [
        {
            "question_text": "1/2 + 1/2 = ?",
            "question_type": "mcq_single",
            "marks": 2,
            "options": [
                {"option_text": "1", "is_correct": True},
                {"option_text": "2", "is_correct": False},
                {"option_text": "0", "is_correct": False},
            ],
        },
        {
            "question_text": "A fraction always has a denominator.",
            "question_type": "true_false",
            "marks": 1,
            "options": [
                {"option_text": "True", "is_correct": True},
                {"option_text": "False", "is_correct": False},
            ],
        },
    ],
}


def create_quiz(client, headers, section_id, subject_id, overrides=None):
    payload = {**QUIZ_PAYLOAD_TEMPLATE, "section_id": section_id, "subject_id": subject_id}
    if overrides:
        payload.update(overrides)
    response = client.post("/api/v1/quizzes", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_quiz_attempt_history_lists_past_attempts_with_titles(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    empty_history = client.get("/api/v1/quizzes/attempts/me", headers=student_headers)
    assert empty_history.status_code == 200
    assert empty_history.json() == []

    take = client.get(f"/api/v1/quizzes/{quiz['id']}/take", headers=student_headers).json()
    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    q1 = take["questions"][0]
    correct_option = next(o for o in q1["options"] if o["option_text"] == "1")
    client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/submit",
        json={"answers": [{"question_id": q1["id"], "selected_option_id": correct_option["id"]}]},
        headers=student_headers,
    )

    history = client.get("/api/v1/quizzes/attempts/me", headers=student_headers)
    assert history.status_code == 200
    entries = history.json()
    assert len(entries) == 1
    assert entries[0]["quiz_title"] == "Fractions Quiz"
    assert entries[0]["score"] == 2
    assert entries[0]["status"] == "graded"


def test_teacher_creates_quiz_for_scheduled_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])
    assert quiz["title"] == "Fractions Quiz"
    assert quiz["is_published"] is True


def test_teacher_cannot_create_quiz_for_unscheduled_class(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade = create_class(client, headers)
    section = create_section(client, headers, class_grade["id"])
    subject = create_subject(client, headers, class_grade["id"])
    create_teacher(client, headers)
    teacher_headers = _login(client, "tom@greenwood.example.com")

    payload = {**QUIZ_PAYLOAD_TEMPLATE, "section_id": section["id"], "subject_id": subject["id"]}
    response = client.post("/api/v1/quizzes", json=payload, headers=teacher_headers)
    assert response.status_code == 403


def test_quiz_requires_exactly_one_correct_option(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    bad_payload = {
        "section_id": section["id"],
        "subject_id": subject["id"],
        "title": "Bad quiz",
        "questions": [
            {
                "question_text": "2+2=?",
                "question_type": "mcq_single",
                "options": [
                    {"option_text": "4", "is_correct": True},
                    {"option_text": "5", "is_correct": True},
                ],
            }
        ],
    }
    response = client.post("/api/v1/quizzes", json=bad_payload, headers=teacher_headers)
    assert response.status_code == 422


def test_true_false_requires_exactly_two_options(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    bad_payload = {
        "section_id": section["id"],
        "subject_id": subject["id"],
        "title": "Bad quiz",
        "questions": [
            {
                "question_text": "The sky is blue.",
                "question_type": "true_false",
                "options": [
                    {"option_text": "True", "is_correct": True},
                    {"option_text": "False", "is_correct": False},
                    {"option_text": "Maybe", "is_correct": False},
                ],
            }
        ],
    }
    response = client.post("/api/v1/quizzes", json=bad_payload, headers=teacher_headers)
    assert response.status_code == 422


def test_student_takes_quiz_and_gets_autograded(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    take = client.get(f"/api/v1/quizzes/{quiz['id']}/take", headers=student_headers)
    assert take.status_code == 200
    questions = take.json()["questions"]
    assert len(questions) == 2
    for q in questions:
        for opt in q["options"]:
            assert "is_correct" not in opt  # correct answers must not leak before submission

    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers)
    assert attempt.status_code == 201
    assert attempt.json()["max_score"] == 3  # 2 + 1 marks

    q1 = questions[0]
    q2 = questions[1]
    correct_option_q1 = next(o for o in q1["options"] if o["option_text"] == "1")
    wrong_option_q2 = next(o for o in q2["options"] if o["option_text"] == "False")

    submit = client.post(
        f"/api/v1/quizzes/attempts/{attempt.json()['id']}/submit",
        json={
            "answers": [
                {"question_id": q1["id"], "selected_option_id": correct_option_q1["id"]},
                {"question_id": q2["id"], "selected_option_id": wrong_option_q2["id"]},
            ]
        },
        headers=student_headers,
    )
    assert submit.status_code == 200, submit.text
    assert submit.json()["score"] == 2  # only q1 correct
    assert submit.json()["status"] == "graded"  # pure MCQ/True-False — nothing left to grade manually

    review = client.get(f"/api/v1/quizzes/{quiz['id']}/my-attempt", headers=student_headers)
    assert review.status_code == 200
    review_body = review.json()
    assert review_body["score"] == 2
    q1_review = next(q for q in review_body["questions"] if q["id"] == q1["id"])
    assert q1_review["is_correct"] is True
    q2_review = next(q for q in review_body["questions"] if q["id"] == q2["id"])
    assert q2_review["is_correct"] is False


def test_cannot_submit_same_attempt_twice(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    client.post(f"/api/v1/quizzes/attempts/{attempt['id']}/submit", json={"answers": []}, headers=student_headers)

    second = client.post(f"/api/v1/quizzes/attempts/{attempt['id']}/submit", json={"answers": []}, headers=student_headers)
    assert second.status_code == 409


def test_starting_attempt_twice_returns_same_attempt(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    first = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    second = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    assert first["id"] == second["id"]


def test_unpublished_quiz_hidden_from_students(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    client.patch(f"/api/v1/quizzes/{quiz['id']}", json={"is_published": False}, headers=teacher_headers)

    listing = client.get("/api/v1/quizzes", headers=student_headers)
    assert listing.json() == []

    take = client.get(f"/api/v1/quizzes/{quiz['id']}/take", headers=student_headers)
    assert take.status_code == 404


def test_teacher_can_only_manage_own_quiz(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    create_teacher(client, headers, email="other@greenwood.example.com")
    teacher_headers = _login(client, teacher["email"])
    other_headers = _login(client, "other@greenwood.example.com")
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    response = client.patch(f"/api/v1/quizzes/{quiz['id']}", json={"is_published": False}, headers=other_headers)
    assert response.status_code == 403
    assert class_grade  # sanity


def test_teacher_sees_results_for_own_quiz(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    client.post(f"/api/v1/quizzes/attempts/{attempt['id']}/submit", json={"answers": []}, headers=student_headers)

    results = client.get(f"/api/v1/quizzes/{quiz['id']}/results", headers=teacher_headers)
    assert results.status_code == 200
    body = results.json()
    assert len(body) == 1
    assert body[0]["student_name"] == "Sam Student"
    assert body[0]["score"] == 0
    assert body[0]["max_score"] == 3


def test_quizzes_isolated_per_tenant(client):
    tokens_a = onboard_and_login_admin(client, slug="greenwood")
    headers_a = auth_headers(tokens_a)
    _, section, subject, teacher = _setup(client, headers_a)
    teacher_headers = _login(client, teacher["email"])
    create_quiz(client, teacher_headers, section["id"], subject["id"])

    tokens_b = onboard_and_login_admin(client, slug="riverside")
    headers_b = auth_headers(tokens_b)
    response = client.get("/api/v1/quizzes", headers=headers_b)
    assert response.status_code == 200
    assert response.json() == []


# --- Short-answer questions and manual grading -------------------------------------------------


def test_short_answer_question_cannot_have_options(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    _, section, subject, teacher = _setup(client, headers)
    teacher_headers = _login(client, teacher["email"])

    bad_payload = {
        "section_id": section["id"],
        "subject_id": subject["id"],
        "title": "Bad quiz",
        "questions": [
            {
                "question_text": "Explain photosynthesis.",
                "question_type": "short_answer",
                "options": [{"option_text": "irrelevant", "is_correct": True}],
            }
        ],
    }
    response = client.post("/api/v1/quizzes", json=bad_payload, headers=teacher_headers)
    assert response.status_code == 422


def test_mixed_quiz_stays_submitted_until_short_answer_graded(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])

    payload = {**MIXED_QUIZ_PAYLOAD, "section_id": section["id"], "subject_id": subject["id"]}
    quiz = client.post("/api/v1/quizzes", json=payload, headers=teacher_headers).json()

    take = client.get(f"/api/v1/quizzes/{quiz['id']}/take", headers=student_headers).json()
    mcq_q, short_q = take["questions"]
    correct_option = next(o for o in mcq_q["options"] if o["option_text"] == "1")
    assert short_q["options"] == []

    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    assert attempt["max_score"] == 5  # 2 + 3

    submit = client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/submit",
        json={
            "answers": [
                {"question_id": mcq_q["id"], "selected_option_id": correct_option["id"]},
                {"question_id": short_q["id"], "answer_text": "Rayleigh scattering."},
            ]
        },
        headers=student_headers,
    )
    assert submit.status_code == 200, submit.text
    body = submit.json()
    assert body["status"] == "submitted"
    assert body["score"] is None
    assert body["percentage"] is None
    assert body["grade"] is None

    # Student's own view reflects the same pending state — no premature score.
    my_attempt = client.get(f"/api/v1/quizzes/{quiz['id']}/my-attempt", headers=student_headers).json()
    assert my_attempt["status"] == "submitted"
    assert my_attempt["score"] is None

    # Results list flags it as needing grading.
    results = client.get(f"/api/v1/quizzes/{quiz['id']}/results", headers=teacher_headers).json()
    assert results[0]["needs_grading"] is True

    # Teacher opens the full review (including the submitted free-text answer) and grades it.
    review = client.get(f"/api/v1/quizzes/attempts/{attempt['id']}/review", headers=teacher_headers)
    assert review.status_code == 200
    short_review = next(q for q in review.json()["questions"] if q["question_type"] == "short_answer")
    assert short_review["answer_text"] == "Rayleigh scattering."
    assert short_review["marks_awarded"] is None

    graded = client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/grade",
        json={"answers": [{"question_id": short_q["id"], "marks_awarded": 2}]},
        headers=teacher_headers,
    )
    assert graded.status_code == 200, graded.text
    graded_body = graded.json()
    assert graded_body["status"] == "graded"
    assert graded_body["score"] == 4  # 2 (mcq) + 2 (short answer)
    assert graded_body["percentage"] == 80.0
    assert graded_body["grade"] == "B"

    results_after = client.get(f"/api/v1/quizzes/{quiz['id']}/results", headers=teacher_headers).json()
    assert results_after[0]["needs_grading"] is False


def test_grade_attempt_rejects_marks_above_question_max(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])

    payload = {**MIXED_QUIZ_PAYLOAD, "section_id": section["id"], "subject_id": subject["id"]}
    quiz = client.post("/api/v1/quizzes", json=payload, headers=teacher_headers).json()
    take = client.get(f"/api/v1/quizzes/{quiz['id']}/take", headers=student_headers).json()
    _, short_q = take["questions"]
    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/submit",
        json={"answers": [{"question_id": short_q["id"], "answer_text": "Some answer"}]},
        headers=student_headers,
    )

    response = client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/grade",
        json={"answers": [{"question_id": short_q["id"], "marks_awarded": 999}]},
        headers=teacher_headers,
    )
    assert response.status_code == 409


def test_non_owning_teacher_cannot_grade_or_review_attempt(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    other_teacher = create_teacher(client, headers, email="other@greenwood.example.com")
    other_headers = _login(client, "other@greenwood.example.com")

    payload = {**MIXED_QUIZ_PAYLOAD, "section_id": section["id"], "subject_id": subject["id"]}
    quiz = client.post("/api/v1/quizzes", json=payload, headers=teacher_headers).json()
    take = client.get(f"/api/v1/quizzes/{quiz['id']}/take", headers=student_headers).json()
    _, short_q = take["questions"]
    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/submit",
        json={"answers": [{"question_id": short_q["id"], "answer_text": "Some answer"}]},
        headers=student_headers,
    )

    assert client.get(f"/api/v1/quizzes/attempts/{attempt['id']}/review", headers=other_headers).status_code == 403
    assert client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/grade",
        json={"answers": [{"question_id": short_q["id"], "marks_awarded": 1}]},
        headers=other_headers,
    ).status_code == 403
    assert other_teacher  # sanity


def test_pure_mcq_quiz_grades_immediately_with_percentage_and_letter_grade(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    take = client.get(f"/api/v1/quizzes/{quiz['id']}/take", headers=student_headers).json()
    q1, q2 = take["questions"]
    correct_q1 = next(o for o in q1["options"] if o["option_text"] == "1")
    correct_q2 = next(o for o in q2["options"] if o["option_text"] == "True")
    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()

    submit = client.post(
        f"/api/v1/quizzes/attempts/{attempt['id']}/submit",
        json={
            "answers": [
                {"question_id": q1["id"], "selected_option_id": correct_q1["id"]},
                {"question_id": q2["id"], "selected_option_id": correct_q2["id"]},
            ]
        },
        headers=student_headers,
    ).json()
    assert submit["status"] == "graded"
    assert submit["score"] == 3
    assert submit["max_score"] == 3
    assert submit["percentage"] == 100.0
    assert submit["grade"] == "A"


def test_cannot_resubmit_a_fully_graded_attempt(client):
    tokens = onboard_and_login_admin(client)
    headers = auth_headers(tokens)
    class_grade, section, subject, teacher = _setup(client, headers)
    student = create_student(client, headers, class_grade["id"], section["id"])
    teacher_headers = _login(client, teacher["email"])
    student_headers = _login(client, student["email"])
    quiz = create_quiz(client, teacher_headers, section["id"], subject["id"])

    attempt = client.post(f"/api/v1/quizzes/{quiz['id']}/attempts/start", headers=student_headers).json()
    first = client.post(f"/api/v1/quizzes/attempts/{attempt['id']}/submit", json={"answers": []}, headers=student_headers)
    assert first.status_code == 200
    assert first.json()["status"] == "graded"

    second = client.post(f"/api/v1/quizzes/attempts/{attempt['id']}/submit", json={"answers": []}, headers=student_headers)
    assert second.status_code == 409
