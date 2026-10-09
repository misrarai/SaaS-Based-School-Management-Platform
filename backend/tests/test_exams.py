from tests.conftest import auth_headers, login, onboard_and_login_admin

PW = "Password123!"


def _post(client, url, headers, json, code=201):
    r = client.post(url, json=json, headers=headers)
    assert r.status_code == code, r.text
    return r.json()


def _login(client, email, slug="greenwood"):
    return auth_headers(login(client, slug, email, PW))


def setup_school(client, slug="greenwood"):
    admin = auth_headers(onboard_and_login_admin(client, slug=slug))
    cls = _post(client, "/api/v1/classes", admin, {"name": "Grade 5", "level_order": 5, "academic_year": "2026"})
    sec_a = _post(client, f"/api/v1/classes/{cls['id']}/sections", admin, {"name": "A"})
    sec_b = _post(client, f"/api/v1/classes/{cls['id']}/sections", admin, {"name": "B"})
    math = _post(client, f"/api/v1/classes/{cls['id']}/subjects", admin, {"name": "Mathematics", "code": "MATH"})
    eng = _post(client, f"/api/v1/classes/{cls['id']}/subjects", admin, {"name": "English", "code": "ENG"})
    students = []
    for i, (name, sec) in enumerate([("Ann Able", sec_a), ("Ben Bold", sec_a), ("Cal Calm", sec_b)], start=1):
        students.append(
            _post(
                client,
                "/api/v1/students",
                admin,
                {
                    "full_name": name,
                    "email": f"s{i}@{slug}.example.com",
                    "password": PW,
                    "class_grade_id": cls["id"],
                    "section_id": sec["id"],
                    "roll_number": str(i),
                },
            )
        )
    teacher = _post(
        client, "/api/v1/teachers", admin, {"full_name": "Tom Teacher", "email": f"tom@{slug}.example.com", "password": PW}
    )
    _post(
        client,
        "/api/v1/schedule/templates",
        admin,
        {
            "section_id": sec_a["id"],
            "subject_id": math["id"],
            "teacher_id": teacher["id"],
            "day_of_week": 0,
            "start_time": "09:00:00",
            "end_time": "09:45:00",
        },
    )
    return {"admin": admin, "cls": cls, "sec_a": sec_a, "sec_b": sec_b, "math": math, "eng": eng,
            "students": students, "teacher": teacher}


def create_exam_with_datesheet(client, ctx):
    scheme = client.post("/api/v1/exams/grading-schemes/default", headers=ctx["admin"])
    assert scheme.status_code == 200, scheme.text
    assert scheme.json()["is_default"] is True
    exam = _post(
        client,
        "/api/v1/exams",
        ctx["admin"],
        {"name": "Mid Term 2026", "academic_year": "2026", "start_date": "2026-10-01", "end_date": "2026-10-10",
         "class_grade_ids": [ctx["cls"]["id"]]},
    )
    assert exam["grading_scheme_id"] == scheme.json()["id"]
    r = client.put(
        f"/api/v1/exams/{exam['id']}/datesheet",
        json={
            "class_grade_id": ctx["cls"]["id"],
            "entries": [
                {"subject_id": ctx["math"]["id"], "exam_date": "2026-10-01", "start_time": "09:00:00",
                 "end_time": "12:00:00", "total_marks": 100, "passing_marks": 40, "room": "Hall 1"},
                {"subject_id": ctx["eng"]["id"], "exam_date": "2026-10-02", "total_marks": 50, "passing_marks": 20},
            ],
        },
        headers=ctx["admin"],
    )
    assert r.status_code == 200, r.text
    assert len(r.json()) == 2
    return exam


def enter_marks(client, headers, exam_id, ctx, subject, section, entries, code=200):
    r = client.put(
        f"/api/v1/exams/{exam_id}/marks",
        json={"class_grade_id": ctx["cls"]["id"], "section_id": section["id"] if section else None,
              "subject_id": subject["id"], "entries": entries},
        headers=headers,
    )
    assert r.status_code == code, r.text
    return r.json()


def test_grading_scheme_crud_and_overlap_validation(client):
    admin = auth_headers(onboard_and_login_admin(client))
    bands = [{"min_percent": 50, "max_percent": 100, "grade": "P"}, {"min_percent": 0, "max_percent": 49.99, "grade": "F"}]
    scheme = _post(client, "/api/v1/exams/grading-schemes", admin, {"name": "Pass/Fail", "bands": bands})
    assert len(scheme["bands"]) == 2
    bad = client.put(
        f"/api/v1/exams/grading-schemes/{scheme['id']}",
        json={"bands": [{"min_percent": 40, "max_percent": 100, "grade": "P"}, {"min_percent": 0, "max_percent": 50, "grade": "F"}]},
        headers=admin,
    )
    assert bad.status_code == 400
    assert client.delete(f"/api/v1/exams/grading-schemes/{scheme['id']}", headers=admin).status_code == 204
    assert client.get("/api/v1/exams/grading-schemes", headers=admin).json() == []


def test_full_exam_flow_results_positions_and_pdfs(client):
    ctx = setup_school(client)
    exam = create_exam_with_datesheet(client, ctx)
    s1, s2, s3 = ctx["students"]
    eid = exam["id"]

    sheet = enter_marks(client, ctx["admin"], eid, ctx, ctx["math"], None, [
        {"student_id": s1["id"], "obtained_marks": 90},
        {"student_id": s2["id"], "obtained_marks": 35, "remarks": "Work harder"},
        {"student_id": s3["id"], "is_absent": True},
    ])
    assert len(sheet["rows"]) == 3
    enter_marks(client, ctx["admin"], eid, ctx, ctx["eng"], None, [
        {"student_id": s1["id"], "obtained_marks": 45},
        {"student_id": s2["id"], "obtained_marks": 40},
        {"student_id": s3["id"], "obtained_marks": 50},
    ])
    # exceeding total is rejected
    enter_marks(client, ctx["admin"], eid, ctx, ctx["eng"], None, [{"student_id": s1["id"], "obtained_marks": 51}], code=400)

    tab = client.get(f"/api/v1/exams/{eid}/results", params={"class_grade_id": ctx["cls"]["id"]}, headers=ctx["admin"])
    assert tab.status_code == 200, tab.text
    rows = {r["full_name"]: r for r in tab.json()["rows"]}
    ann, ben, cal = rows["Ann Able"], rows["Ben Bold"], rows["Cal Calm"]
    assert ann["total_obtained"] == 135 and ann["total_marks"] == 150
    assert ann["percentage"] == 90.0 and ann["grade"] == "A+" and ann["passed"] is True
    assert ann["position"] == 1 and ann["section_position"] == 1
    assert ben["position"] == 2 and ben["passed"] is False  # failed maths
    assert cal["position"] == 3 and cal["section_position"] == 1 and cal["passed"] is False  # absent
    assert cal["subjects"][0]["grade"] == "ABS" or cal["subjects"][1]["grade"] == "ABS"

    sec_tab = client.get(f"/api/v1/exams/{eid}/results",
                         params={"class_grade_id": ctx["cls"]["id"], "section_id": ctx["sec_a"]["id"]}, headers=ctx["admin"])
    assert len(sec_tab.json()["rows"]) == 2

    for url, params in [
        (f"/api/v1/exams/{eid}/results/pdf", {"class_grade_id": ctx["cls"]["id"]}),
        (f"/api/v1/exams/{eid}/datesheet/pdf", {"class_grade_id": ctx["cls"]["id"]}),
        (f"/api/v1/exams/{eid}/students/{s1['id']}/result-card", {}),
    ]:
        r = client.get(url, params=params, headers=ctx["admin"])
        assert r.status_code == 200, r.text
        assert r.headers["content-type"] == "application/pdf"
        assert r.content.startswith(b"%PDF")

    assert client.put(f"/api/v1/exams/{eid}/students/{s1['id']}/remarks", json={"remarks": "Excellent work"},
                      headers=ctx["admin"]).status_code == 204
    res = client.get(f"/api/v1/exams/{eid}/students/{s1['id']}/result", headers=ctx["admin"]).json()
    assert res["result"]["remarks"] == "Excellent work" and res["class_strength"] == 3


def test_teacher_marks_entry_limited_to_scheduled_subjects(client):
    ctx = setup_school(client)
    exam = create_exam_with_datesheet(client, ctx)
    teacher = _login(client, "tom@greenwood.example.com")
    s1 = ctx["students"][0]

    mine = client.get("/api/v1/exams/teacher/my-subjects", headers=teacher).json()
    assert len(mine) == 1 and mine[0]["subject_id"] == ctx["math"]["id"]

    sheet = client.get(f"/api/v1/exams/{exam['id']}/marks",
                       params={"class_grade_id": ctx["cls"]["id"], "section_id": ctx["sec_a"]["id"], "subject_id": ctx["math"]["id"]},
                       headers=teacher)
    assert sheet.status_code == 200 and len(sheet.json()["rows"]) == 2
    enter_marks(client, teacher, exam["id"], ctx, ctx["math"], ctx["sec_a"], [{"student_id": s1["id"], "obtained_marks": 70}])
    # not scheduled for English or for section B
    enter_marks(client, teacher, exam["id"], ctx, ctx["eng"], ctx["sec_a"], [{"student_id": s1["id"], "obtained_marks": 30}], code=403)
    enter_marks(client, teacher, exam["id"], ctx, ctx["math"], ctx["sec_b"], [], code=403)
    # student from section B can't be entered via section A sheet
    enter_marks(client, ctx["admin"], exam["id"], ctx, ctx["math"], ctx["sec_a"],
                [{"student_id": ctx["students"][2]["id"], "obtained_marks": 10}], code=400)

    # once results are published, teacher marks are locked
    client.post(f"/api/v1/exams/{exam['id']}/publish-results", json={"published": True}, headers=ctx["admin"])
    enter_marks(client, teacher, exam["id"], ctx, ctx["math"], ctx["sec_a"], [{"student_id": s1["id"], "obtained_marks": 71}], code=403)
    # teachers cannot create exams
    assert client.post("/api/v1/exams", json={"name": "X"}, headers=teacher).status_code == 403


def test_student_and_parent_see_only_published_own_results(client):
    ctx = setup_school(client)
    exam = create_exam_with_datesheet(client, ctx)
    s1, s2, _ = ctx["students"]
    enter_marks(client, ctx["admin"], exam["id"], ctx, ctx["math"], None, [{"student_id": s1["id"], "obtained_marks": 80}])
    _post(client, f"/api/v1/students/{s1['id']}/parents", ctx["admin"],
          {"full_name": "Pat Parent", "email": "parent@greenwood.example.com", "password": PW})
    student = _login(client, "s1@greenwood.example.com")
    parent = _login(client, "parent@greenwood.example.com")

    # draft exam: nothing visible
    assert client.get("/api/v1/exams/my", headers=student).json() == []
    assert client.get(f"/api/v1/exams/{exam['id']}/students/{s1['id']}/result", headers=student).status_code == 403
    assert client.get("/api/v1/exams", headers=student).status_code == 403

    client.patch(f"/api/v1/exams/{exam['id']}", json={"status": "published"}, headers=ctx["admin"])
    my = client.get("/api/v1/exams/my", headers=student).json()
    assert len(my) == 1 and my[0]["results_published"] is False and my[0]["grade"] is None
    ds = client.get(f"/api/v1/exams/{exam['id']}/datesheet", headers=student)
    assert ds.status_code == 200 and len(ds.json()) == 2
    assert client.get(f"/api/v1/exams/{exam['id']}/students/{s1['id']}/result-card", headers=student).status_code == 403

    client.post(f"/api/v1/exams/{exam['id']}/publish-results", json={"published": True}, headers=ctx["admin"])
    my = client.get("/api/v1/exams/my", headers=student).json()
    assert my[0]["position"] == 1 and my[0]["percentage"] is not None
    assert client.get(f"/api/v1/exams/{exam['id']}/students/{s1['id']}/result-card", headers=student).status_code == 200
    # student cannot see a classmate
    assert client.get(f"/api/v1/exams/{exam['id']}/students/{s2['id']}/result", headers=student).status_code == 403

    # parent: own child yes, other child no
    assert client.get("/api/v1/exams/my", params={"student_id": s1["id"]}, headers=parent).status_code == 200
    assert client.get("/api/v1/exams/my", params={"student_id": s2["id"]}, headers=parent).status_code == 403
    r = client.get(f"/api/v1/exams/{exam['id']}/students/{s1['id']}/result-card", headers=parent)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert client.get(f"/api/v1/exams/{exam['id']}/students/{s2['id']}/result", headers=parent).status_code == 403


def test_exams_are_tenant_isolated(client):
    ctx = setup_school(client)
    exam = create_exam_with_datesheet(client, ctx)
    other = auth_headers(onboard_and_login_admin(client, slug="riverside"))
    assert client.get("/api/v1/exams", headers=other).json() == []
    assert client.get(f"/api/v1/exams/{exam['id']}", headers=other).status_code == 404
    assert client.get(f"/api/v1/exams/{exam['id']}/results", params={"class_grade_id": ctx["cls"]["id"]},
                      headers=other).status_code == 404
    # cannot attach another tenant's class
    assert client.post("/api/v1/exams", json={"name": "T", "class_grade_ids": [ctx["cls"]["id"]]},
                       headers=other).status_code == 404


def test_removing_class_and_deleting_exam_cleans_up(client):
    ctx = setup_school(client)
    exam = create_exam_with_datesheet(client, ctx)
    enter_marks(client, ctx["admin"], exam["id"], ctx, ctx["math"], None,
                [{"student_id": ctx["students"][0]["id"], "obtained_marks": 50}])
    updated = client.patch(f"/api/v1/exams/{exam['id']}", json={"class_grade_ids": []}, headers=ctx["admin"]).json()
    assert updated["classes"] == []
    assert client.get(f"/api/v1/exams/{exam['id']}/datesheet", headers=ctx["admin"]).json() == []
    assert client.delete(f"/api/v1/exams/{exam['id']}", headers=ctx["admin"]).status_code == 204
    assert client.get(f"/api/v1/exams/{exam['id']}", headers=ctx["admin"]).status_code == 404
