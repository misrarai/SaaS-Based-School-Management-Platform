from datetime import date, timedelta

from tests.conftest import auth_headers, onboard_and_login_admin

BASE = "/api/v1/inventory"


def _post(client, headers, path, payload, expected=201):
    resp = client.post(f"{BASE}{path}", json=payload, headers=headers)
    assert resp.status_code == expected, resp.text
    return resp.json()


def _setup(client, slug="greenwood"):
    headers = auth_headers(onboard_and_login_admin(client, slug=slug))
    cat = _post(client, headers, "/categories", {"name": "Uniforms"})
    unit = _post(client, headers, "/units", {"name": "Piece", "abbreviation": "pc"})
    main = _post(client, headers, "/stores", {"name": "Main Store", "location": "Block A"})
    shop = _post(client, headers, "/stores", {"name": "School Shop"})
    supplier = _post(client, headers, "/suppliers", {"name": "ABC Traders", "phone": "0300", "address": "Lahore"})
    shirt = _post(client, headers, "/items", {
        "name": "School Shirt", "code": "SH-01", "category_id": cat["id"], "unit_id": unit["id"],
        "reorder_level": 10, "sale_price": 800,
    })
    return headers, {"cat": cat, "unit": unit, "main": main, "shop": shop, "supplier": supplier, "shirt": shirt}


def test_masters_and_item_codes(client):
    headers, ctx = _setup(client)
    assert ctx["shirt"]["category_name"] == "Uniforms" and ctx["shirt"]["unit_name"] == "pc"
    auto = _post(client, headers, "/items", {"name": "Notebook"})
    assert auto["code"] == "ITM-0001"
    _post(client, headers, "/items", {"name": "Dup", "code": "SH-01"}, expected=409)
    _post(client, headers, "/categories", {"name": "Uniforms"}, expected=409)
    assert len(client.get(f"{BASE}/items", params={"q": "shirt"}, headers=headers).json()) == 1
    assert client.delete(f"{BASE}/categories/{ctx['cat']['id']}", headers=headers).status_code == 409


def test_purchase_issue_adjust_transfer_and_stock_levels(client):
    headers, ctx = _setup(client)
    shirt, main, shop = ctx["shirt"], ctx["main"], ctx["shop"]
    pur = _post(client, headers, "/purchases", {
        "store_id": main["id"], "supplier_id": ctx["supplier"]["id"], "txn_date": "2026-03-01",
        "invoice_no": "INV-77", "lines": [{"item_id": shirt["id"], "quantity": 50, "unit_price": 500}],
    })
    assert pur["txn_number"] == "PUR-0001" and pur["total_amount"] == 25000

    iss = _post(client, headers, "/issues", {
        "store_id": main["id"], "txn_date": "2026-03-02", "issued_to_type": "class", "issued_to": "Grade 5",
        "lines": [{"item_id": shirt["id"], "quantity": 5}],
    })
    assert iss["txn_number"] == "ISS-0001"
    _post(client, headers, "/issues", {
        "store_id": main["id"], "txn_date": "2026-03-02", "issued_to": "Too many",
        "lines": [{"item_id": shirt["id"], "quantity": 100}],
    }, expected=422)

    _post(client, headers, "/adjustments", {
        "store_id": main["id"], "txn_date": "2026-03-03", "reason": "damage", "direction": "decrease",
        "lines": [{"item_id": shirt["id"], "quantity": 2}],
    })
    _post(client, headers, "/transfers", {
        "store_id": main["id"], "to_store_id": shop["id"], "txn_date": "2026-03-04",
        "lines": [{"item_id": shirt["id"], "quantity": 20}],
    })
    _post(client, headers, "/transfers", {
        "store_id": main["id"], "to_store_id": main["id"], "txn_date": "2026-03-04",
        "lines": [{"item_id": shirt["id"], "quantity": 1}],
    }, expected=422)

    levels = {r["store_name"]: r["quantity"] for r in client.get(f"{BASE}/stock", headers=headers).json()}
    assert levels == {"Main Store": 23, "School Shop": 20}
    item = client.get(f"{BASE}/items/{shirt['id']}", headers=headers).json()
    assert item["current_stock"] == 43

    issues = client.get(f"{BASE}/transactions", params={"type": "issue"}, headers=headers).json()
    assert len(issues) == 1 and issues[0]["issued_to"] == "Grade 5"


def test_low_stock_report(client):
    headers, ctx = _setup(client)
    _post(client, headers, "/purchases", {
        "store_id": ctx["main"]["id"], "txn_date": "2026-03-01",
        "lines": [{"item_id": ctx["shirt"]["id"], "quantity": 8, "unit_price": 500}],
    })
    _post(client, headers, "/items", {"name": "No reorder level"})
    low = client.get(f"{BASE}/stock/low", headers=headers).json()
    assert len(low) == 1
    assert low[0]["item_code"] == "SH-01" and low[0]["shortfall"] == 2


def test_point_of_sale_reduces_stock_and_receipt(client):
    headers, ctx = _setup(client)
    _post(client, headers, "/purchases", {
        "store_id": ctx["shop"]["id"], "txn_date": "2026-03-01",
        "lines": [{"item_id": ctx["shirt"]["id"], "quantity": 10, "unit_price": 500}],
    })
    sale = _post(client, headers, "/sales", {
        "store_id": ctx["shop"]["id"], "txn_date": "2026-03-05", "customer_name": "Walk-in parent",
        "discount": 100, "amount_paid": 2000, "lines": [{"item_id": ctx["shirt"]["id"], "quantity": 2}],
    })
    assert sale["txn_number"] == "SAL-0001"
    assert sale["lines"][0]["unit_price"] == 800  # defaults to item sale price
    assert sale["total_amount"] == 1500 and sale["amount_paid"] == 2000

    _post(client, headers, "/sales", {
        "store_id": ctx["shop"]["id"], "txn_date": "2026-03-05", "amount_paid": 10,
        "lines": [{"item_id": ctx["shirt"]["id"], "quantity": 1}],
    }, expected=422)
    _post(client, headers, "/sales", {
        "store_id": ctx["shop"]["id"], "txn_date": "2026-03-05",
        "lines": [{"item_id": ctx["shirt"]["id"], "quantity": 50}],
    }, expected=422)

    stock = client.get(f"{BASE}/stock", params={"store_id": ctx["shop"]["id"]}, headers=headers).json()
    assert stock[0]["quantity"] == 8

    receipt = client.get(f"{BASE}/sales/{sale['id']}/receipt", headers=headers)
    assert receipt.status_code == 200 and receipt.content[:4] == b"%PDF"


def test_fixed_asset_straight_line_depreciation_and_disposal(client):
    headers, _ = _setup(client)
    purchase = date.today() - timedelta(days=730)
    asset = _post(client, headers, "/assets", {
        "name": "Photocopier", "category": "Equipment", "location": "Office", "purchase_date": purchase.isoformat(),
        "cost": 100000, "depreciation_rate": 20, "assigned_to": "Admin office",
    })
    assert asset["asset_tag"] == "AST-0001"
    assert asset["annual_depreciation"] == 20000
    assert asset["accumulated_depreciation"] == 40000 and asset["book_value"] == 60000

    old = _post(client, headers, "/assets", {
        "asset_tag": "OLD-1", "name": "Old Bus", "purchase_date": "2010-01-01", "cost": 500000,
        "salvage_value": 50000, "depreciation_rate": 10,
    })
    assert old["book_value"] == 50000  # never depreciates below salvage

    disposed = client.post(f"{BASE}/assets/{asset['id']}/dispose", json={
        "disposal_date": date.today().isoformat(), "disposal_value": 55000, "disposal_notes": "Sold"}, headers=headers)
    assert disposed.status_code == 200 and disposed.json()["status"] == "disposed"
    assert client.patch(f"{BASE}/assets/{asset['id']}", json={"name": "x"}, headers=headers).status_code == 409
    active = client.get(f"{BASE}/assets", params={"status": "active"}, headers=headers).json()
    assert [a["asset_tag"] for a in active] == ["OLD-1"]


def test_inventory_tenant_isolation(client):
    headers_a, ctx = _setup(client, slug="greenwood")
    headers_b = auth_headers(onboard_and_login_admin(client, slug="riverside"))
    assert client.get(f"{BASE}/items/{ctx['shirt']['id']}", headers=headers_b).status_code == 404
    assert client.get(f"{BASE}/items", headers=headers_b).json() == []
    store_b = _post(client, headers_b, "/stores", {"name": "B store"})
    _post(client, headers_b, "/purchases", {
        "store_id": store_b["id"], "txn_date": "2026-03-01",
        "lines": [{"item_id": ctx["shirt"]["id"], "quantity": 1}],
    }, expected=404)
