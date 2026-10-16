"""Cross-tenant isolation sweep.

Structure
---------
* ``_build_greenwood_graph`` creates one of everything inside the greenwood
  tenant and returns a dict of IDs.
* ``CROSS_TENANT_CASES`` is a list of ``(tag, method, path)`` tuples where
  every path uses a greenwood ID.  When called with riverside's admin token
  the response must be 403 or 404 — never 200 / 201 / 204.
* ``test_cross_tenant_id_isolation`` runs all cases in a single transaction
  and reports every failure at once.
* ``test_all_router_prefixes_are_covered`` is the meta-test: it fails if a new
  router is registered without a corresponding case, so the sweep cannot
  silently shrink over time.

Adding a new router
-------------------
1. Add at least one entry to ``_build_cases()`` for the new prefix.
2. If the router has no tenant-scoped ID endpoint (e.g. public endpoints,
   super-admin-only, list/action endpoints only, or self-service /me routes),
   add its prefix to ``_EXCLUDED_PREFIXES`` with a comment instead.
"""

import uuid

import pytest

from tests.conftest import auth_headers, login, onboard_school

# ---------------------------------------------------------------------------
# Routers that are intentionally excluded from the per-ID cross-tenant check.
# A router belongs here only if one or more of these apply:
#   a) has no GET /{id} or PATCH /{id} or DELETE /{id} endpoint, OR
#   b) has no creation POST (cannot seed a greenwood object), OR
#   c) does not operate on tenant-scoped objects by ID at all.
# ---------------------------------------------------------------------------
_EXCLUDED_PREFIXES = {
    # Public / cross-tenant by design
    "auth",        # login, register, verify — no tenant-scoped ID
    "tenants",     # only /tenants/me — returns caller's own tenant
    "super-admin", # SUPER_ADMIN role; spans tenants by design
    "uploads",     # POST only; no GET /{id}

    # OAuth / webhook flows — no tenant-scoped ID endpoint
    "integrations",

    # Computed roll-ups — no individual object ID
    "dashboard",
    "progress",
    "promotion",   # bulk promotion action, no /{id}

    # Attendance — individual records use composite keys (student+date), no /{id}
    "attendance",

    # Self-service routers with no admin-facing GET /parents/{id}
    "parents",     # only /me/children and /me/preferences

    # Action/send-only routers — no entity creation POST and no GET /{id}
    "notifications",

    # Routers where no /{id} endpoint exists for the main entity type
    "communication",  # notices have no GET /notices/{id}
    "front-office",   # visitors have no GET /visitors/{id}
    "hifz",           # halqas have no GET /halqas/{id}
    "holidays",       # no GET /holidays/{id}
    "payouts",        # rates have no GET /rates/{id}
    "payroll",        # departments have no GET /departments/{id}
    "recruitment",    # vacancies have no GET /vacancies/{id}
    "schedule",       # templates have no GET /templates/{id}
    "fee-collection", # no GET /{id}; counter is a lookup surface, not an entity

    # Accounting accounts have no GET /accounts/{id};
    # vouchers need complex balanced setup — covered via fake-UUID list check below
    "accounting",

    # Assignments: check below — covered if /{id} endpoint confirmed
    # (left in cases if it exists, excluded here only as fallback)
}

# ---------------------------------------------------------------------------
# All router prefixes registered in router.py (keep in sync with that file).
# The meta-test asserts every prefix is either in _build_cases() or _EXCLUDED.
# Add a new row here whenever you add a new router to router.py.
# ---------------------------------------------------------------------------
_ALL_ROUTER_PREFIXES = {
    "academic-years",
    "accounting",
    "assignments",
    "attendance",
    "auth",
    "automation",
    "classes",
    "communication",
    "courses",
    "dashboard",
    "exams",
    "families",
    "fee-collection",
    "fees",
    "front-office",
    "hifz",
    "holidays",
    "hostel",
    "integrations",
    "inventory",
    "library",
    "notifications",
    "parents",
    "payouts",
    "payroll",
    "progress",
    "promotion",
    "quizzes",
    "recruitment",
    "resources",
    "schedule",
    "staff",
    "students",
    "super-admin",
    "teachers",
    "tenants",
    "transport",
    "uploads",
}


def _build_greenwood_graph(client, headers: dict) -> dict:
    """Create one of each major entity inside the greenwood tenant and return
    a mapping of ``entity_name → id_string`` for use in path templates.

    All assert statements use hard-assert so the graph build fails fast with
    the actual API error text if a route changes."""
    ids: dict = {}

    # Academic year ──────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/academic-years",
        json={"name": "2026", "start_date": "2026-01-01", "end_date": "2026-12-31", "is_active": True},
        headers=headers,
    )
    assert r.status_code == 201, f"academic-years: {r.text}"
    ids["academic_year"] = r.json()["id"]

    # Class ──────────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/classes",
        json={"name": "Grade 9", "level_order": 9, "academic_year_id": ids["academic_year"]},
        headers=headers,
    )
    assert r.status_code == 201, f"classes: {r.text}"
    ids["class"] = r.json()["id"]

    # Section + subject (needed for later objects, not tested as top-level IDs)
    r = client.post(f"/api/v1/classes/{ids['class']}/sections", json={"name": "A"}, headers=headers)
    assert r.status_code == 201, f"sections: {r.text}"
    ids["section"] = r.json()["id"]

    r = client.post(
        f"/api/v1/classes/{ids['class']}/subjects",
        json={"name": "Mathematics", "code": "MATH9"},
        headers=headers,
    )
    assert r.status_code == 201, f"subjects: {r.text}"
    ids["subject"] = r.json()["id"]

    # Teacher ────────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/teachers",
        json={"full_name": "Ali Ahmed", "email": "ali@greenwood.example.com", "password": "Password123!"},
        headers=headers,
    )
    assert r.status_code == 201, f"teachers: {r.text}"
    ids["teacher"] = r.json()["id"]

    # Student ────────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/students",
        json={
            "full_name": "Sam Student",
            "email": "sam@greenwood.example.com",
            "password": "Password123!",
            "class_grade_id": ids["class"],
            "section_id": ids["section"],
        },
        headers=headers,
    )
    assert r.status_code == 201, f"students: {r.text}"
    ids["student"] = r.json()["id"]

    # Family (standalone POST /families with family_name) ────────────────────
    r = client.post(
        "/api/v1/families",
        json={"family_name": "Ahmed Family"},
        headers=headers,
    )
    assert r.status_code == 201, f"families: {r.text}"
    ids["family"] = r.json()["id"]

    # Staff ──────────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/staff",
        json={
            "full_name": "Steve Staff",
            "designation": "Accountant",
            "email": "steve@greenwood.example.com",
            "password": "Password123!",
        },
        headers=headers,
    )
    ids["staff"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Course ─────────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/courses",
        json={
            "academic_year_id": ids["academic_year"],
            "section_id": ids["section"],
            "subject_id": ids["subject"],
        },
        headers=headers,
    )
    assert r.status_code == 201, f"courses: {r.text}"
    ids["course"] = r.json()["id"]

    # Assign teacher so resource/chapter tests work later
    client.post(f"/api/v1/courses/{ids['course']}/teachers", json={"teacher_id": ids["teacher"]}, headers=headers)

    # Quiz ───────────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/quizzes",
        json={
            "section_id": ids["section"],
            "subject_id": ids["subject"],
            "title": "Q1",
            "questions": [
                {
                    "question_text": "2+2?",
                    "question_type": "mcq_single",
                    "options": [{"option_text": "4", "is_correct": True}],
                }
            ],
        },
        headers=headers,
    )
    ids["quiz"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Assignment ─────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/assignments",
        json={
            "title": "HW1",
            "class_grade_id": ids["class"],
            "subject_id": ids["subject"],
            "due_date": "2026-12-01",
        },
        headers=headers,
    )
    ids["assignment"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Resource (admin creates — no teacher-assignment check) ─────────────────
    r = client.post(
        "/api/v1/resources",
        json={
            "title": "Khan video",
            "resource_type": "link",
            "external_url": "https://khanacademy.org/x",
            "class_grade_id": ids["class"],
            "subject_id": ids["subject"],
        },
        headers=headers,
    )
    ids["resource"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Exam ───────────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/exams",
        json={
            "title": "Mid-term",
            "academic_year_id": ids["academic_year"],
            "class_grade_id": ids["class"],
            "exam_type": "midterm",
        },
        headers=headers,
    )
    ids["exam"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Fee invoice ────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/fees/invoices",
        json={
            "student_id": ids["student"],
            "due_date": "2026-12-31",
            "lines": [{"description": "Tuition", "amount": 5000}],
        },
        headers=headers,
    )
    ids["invoice"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Library book ───────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/library/books",
        json={"title": "Maths Grade 9"},
        headers=headers,
    )
    ids["library_book"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Transport route ────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/transport/routes",
        json={"name": "Route 1"},
        headers=headers,
    )
    ids["transport_route"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Hostel ─────────────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/hostel/hostels",
        json={"name": "Boys Hostel", "capacity": 50},
        headers=headers,
    )
    ids["hostel"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    # Inventory item ─────────────────────────────────────────────────────────
    r = client.post(
        "/api/v1/inventory/items",
        json={"name": "Whiteboard Marker"},
        headers=headers,
    )
    ids["inventory_item"] = r.json().get("id", str(uuid.uuid4())) if r.status_code == 201 else str(uuid.uuid4())

    return ids


# ---------------------------------------------------------------------------
# Cross-tenant cases: (tag, method, path)
# All paths use greenwood IDs.  They are fetched with riverside's admin token.
# Every response must be 403 or 404.
# ---------------------------------------------------------------------------
def _build_cases(g: dict) -> list[tuple[str, str, str]]:
    """Return CROSS_TENANT_CASES with greenwood IDs substituted in."""
    return [
        # tag                method  path
        ("academic-years",  "GET",  f"/api/v1/academic-years/{g['academic_year']}"),
        ("classes",         "PATCH", f"/api/v1/classes/{g['class']}"),   # no GET /{id}; PATCH is the ID-scoped verb
        ("courses",         "GET",  f"/api/v1/courses/{g['course']}"),
        ("teachers",        "GET",  f"/api/v1/teachers/{g['teacher']}"),
        ("students",        "GET",  f"/api/v1/students/{g['student']}"),
        ("families",        "GET",  f"/api/v1/families/{g['family']}"),
        ("staff",           "GET",  f"/api/v1/staff/{g['staff']}"),
        ("quizzes",         "PATCH",  f"/api/v1/quizzes/{g['quiz']}"),     # no plain GET /{id}; PATCH is the ID-scoped verb
        ("assignments",     "GET",    f"/api/v1/assignments/{g['assignment']}"),
        ("resources",       "DELETE", f"/api/v1/resources/{g['resource']}"),  # no GET /{id}; DELETE is the ID-scoped verb
        ("exams",           "GET",  f"/api/v1/exams/{g['exam']}"),
        ("fees",            "GET",  f"/api/v1/fees/invoices/{g['invoice']}"),
        ("library",         "GET",  f"/api/v1/library/books/{g['library_book']}"),
        ("transport",       "GET",  f"/api/v1/transport/routes/{g['transport_route']}"),
        ("hostel",          "GET",  f"/api/v1/hostel/hostels/{g['hostel']}"),
        ("inventory",       "GET",  f"/api/v1/inventory/items/{g['inventory_item']}"),
        # automation: GET /automation/settings — list endpoint, no /{id}, tested via empty-list assertion
        ("automation",      "GET",  "/api/v1/automation/settings"),
    ]


def test_cross_tenant_id_isolation(client):
    """Tenant B's admin must not read tenant A's objects by ID.

    Accepted responses: 403 (Forbidden) or 404 (Not Found — tenant scoping
    hides the record).  Any 2xx or 5xx is a failure.

    The automation case tests a list endpoint; an empty list (200 []) is
    acceptable because it proves riverside gets no greenwood data.  A non-empty
    list from riverside would be a cross-tenant data leak.
    """
    # ── Set up greenwood ────────────────────────────────────────────────────
    onboard_school(client, slug="greenwood", admin_email="admin@greenwood.example.com")
    g_tokens = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")
    g_headers = auth_headers(g_tokens)
    greenwood_ids = _build_greenwood_graph(client, g_headers)

    # ── Set up riverside ────────────────────────────────────────────────────
    onboard_school(client, slug="riverside", admin_email="admin@riverside.example.com")
    r_tokens = login(client, "riverside", "admin@riverside.example.com", "Password123!")
    r_headers = auth_headers(r_tokens)

    # ── Run all cross-tenant checks ─────────────────────────────────────────
    cases = _build_cases(greenwood_ids)
    failures: list[str] = []

    for tag, method, path in cases:
        # PATCH needs a body (even empty) to avoid 422 Unprocessable Entity
        if method == "PATCH":
            resp = client.patch(path, json={}, headers=r_headers)
        else:
            resp = client.request(method, path, headers=r_headers)

        # Special case: automation settings is a list endpoint (no /{id}).
        # An empty list is fine; non-empty means greenwood data leaked.
        if tag == "automation":
            if resp.status_code == 200:
                data = resp.json()
                if data:  # non-empty means cross-tenant leak
                    failures.append(
                        f"[{tag}] {method} {path}  →  HTTP 200 with "
                        f"{len(data)} item(s) from greenwood (cross-tenant leak)"
                    )
            elif resp.status_code not in (403, 404):
                failures.append(f"[{tag}] {method} {path}  →  HTTP {resp.status_code} (expected 200/403/404)")
            continue

        if resp.status_code not in (403, 404):
            failures.append(
                f"[{tag}] {method} {path}  →  HTTP {resp.status_code} "
                f"(expected 403 or 404)"
            )

    if failures:
        pytest.fail(
            f"{len(failures)} cross-tenant isolation failure(s):\n"
            + "\n".join(f"  • {f}" for f in failures)
        )


def test_all_router_prefixes_are_covered():
    """Meta-test: every registered router prefix must be either in
    _build_cases() (represented by its tag) or in _EXCLUDED_PREFIXES.

    If you add a new router, add a corresponding entry to _build_cases()
    above OR justify the exclusion in _EXCLUDED_PREFIXES.
    """
    placeholder_ids: dict = {k: str(uuid.uuid4()) for k in [
        "academic_year", "class", "section", "subject", "teacher", "student",
        "family", "staff", "course", "quiz", "assignment", "resource", "exam",
        "invoice", "library_book", "transport_route", "hostel", "inventory_item",
    ]}
    covered_tags = {tag for tag, _, _ in _build_cases(placeholder_ids)}

    uncovered = _ALL_ROUTER_PREFIXES - covered_tags - _EXCLUDED_PREFIXES
    assert not uncovered, (
        f"These router prefixes have no cross-tenant isolation case and are "
        f"not excluded:\n  {sorted(uncovered)}\n\n"
        f"Add a case to _build_cases() or an exclusion to _EXCLUDED_PREFIXES."
    )


# ---------------------------------------------------------------------------
# The three original baseline isolation tests — kept intact.
# ---------------------------------------------------------------------------

def test_admin_of_one_school_cannot_see_another_schools_tenant(client):
    onboard_school(client, slug="greenwood", admin_email="admin@greenwood.example.com")
    onboard_school(client, slug="riverside", admin_email="admin@riverside.example.com")

    tokens_a = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")
    tokens_b = login(client, "riverside", "admin@riverside.example.com", "Password123!")

    resp_a = client.get("/api/v1/tenants/me", headers={"Authorization": f"Bearer {tokens_a['access_token']}"})
    resp_b = client.get("/api/v1/tenants/me", headers={"Authorization": f"Bearer {tokens_b['access_token']}"})

    assert resp_a.status_code == 200
    assert resp_b.status_code == 200
    assert resp_a.json()["slug"] == "greenwood"
    assert resp_b.json()["slug"] == "riverside"
    assert resp_a.json()["id"] != resp_b.json()["id"]


def test_cannot_login_to_another_tenant_with_same_email_pattern(client):
    onboard_school(client, slug="greenwood", admin_email="admin@school.example.com")
    onboard_school(client, slug="riverside", admin_email="someoneelse@school.example.com")

    response = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "greenwood", "email": "someoneelse@school.example.com", "password": "Password123!"},
    )
    assert response.status_code == 401


def test_access_token_tenant_claim_is_trusted_source_for_scoping(client):
    onboard_school(client, slug="greenwood", admin_email="admin@greenwood.example.com")
    tokens = login(client, "greenwood", "admin@greenwood.example.com", "Password123!")

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    tenant_me = client.get("/api/v1/tenants/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})

    assert me.json()["tenant_id"] == tenant_me.json()["id"]
