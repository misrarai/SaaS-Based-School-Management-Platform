import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.inventory import AssetStatus, StockTxnType
from app.models.tenant import Tenant
from app.models.user import RoleEnum, User
from app.schemas.inventory import (
    AdjustmentCreate,
    AssetCreate,
    AssetDispose,
    AssetOut,
    AssetUpdate,
    CategoryIn,
    CategoryOut,
    IssueCreate,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    LowStockRow,
    PurchaseCreate,
    SaleCreate,
    StockLevel,
    StockTxnOut,
    StoreIn,
    StoreOut,
    StoreUpdate,
    SupplierIn,
    SupplierOut,
    SupplierUpdate,
    TransferCreate,
    UnitIn,
    UnitOut,
)
from app.services.finance_pdf import render_sale_receipt
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["inventory"])
admin_only = require_role(RoleEnum.ADMIN)


# ---------- Categories / units / stores / suppliers ----------
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).list_categories(current_user.tenant_id)


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryIn, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_category(current_user.tenant_id, payload)


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: uuid.UUID, payload: CategoryIn, current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).update_category(current_user.tenant_id, category_id, payload)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    InventoryService(db).delete_category(current_user.tenant_id, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/units", response_model=list[UnitOut])
def list_units(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).list_units(current_user.tenant_id)


@router.post("/units", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(payload: UnitIn, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_unit(current_user.tenant_id, payload)


@router.delete("/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(unit_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    InventoryService(db).delete_unit(current_user.tenant_id, unit_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/stores", response_model=list[StoreOut])
def list_stores(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).list_stores(current_user.tenant_id)


@router.post("/stores", response_model=StoreOut, status_code=status.HTTP_201_CREATED)
def create_store(payload: StoreIn, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_store(current_user.tenant_id, payload)


@router.patch("/stores/{store_id}", response_model=StoreOut)
def update_store(
    store_id: uuid.UUID, payload: StoreUpdate, current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).update_store(current_user.tenant_id, store_id, payload)


@router.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).list_suppliers(current_user.tenant_id)


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierIn, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_supplier(current_user.tenant_id, payload)


@router.patch("/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: uuid.UUID, payload: SupplierUpdate, current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).update_supplier(current_user.tenant_id, supplier_id, payload)


# ---------- Items ----------
@router.get("/items", response_model=list[ItemOut])
def list_items(
    q: str | None = Query(default=None),
    category_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).list_items(current_user.tenant_id, q, category_id)


@router.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_item(current_user.tenant_id, payload)


@router.get("/items/{item_id}", response_model=ItemOut)
def get_item(item_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).get_item_out(current_user.tenant_id, item_id)


@router.patch("/items/{item_id}", response_model=ItemOut)
def update_item(
    item_id: uuid.UUID, payload: ItemUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return InventoryService(db).update_item(current_user.tenant_id, item_id, payload)


# ---------- Stock documents ----------
@router.get("/transactions", response_model=list[StockTxnOut])
def list_transactions(
    txn_type: StockTxnType | None = Query(default=None, alias="type"),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).list_txns(current_user.tenant_id, txn_type)


@router.get("/transactions/{txn_id}", response_model=StockTxnOut)
def get_transaction(txn_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).get_txn(current_user.tenant_id, txn_id)


@router.post("/purchases", response_model=StockTxnOut, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: PurchaseCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_purchase(current_user.tenant_id, current_user.id, payload)


@router.post("/issues", response_model=StockTxnOut, status_code=status.HTTP_201_CREATED)
def create_issue(payload: IssueCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_issue(current_user.tenant_id, current_user.id, payload)


@router.post("/adjustments", response_model=StockTxnOut, status_code=status.HTTP_201_CREATED)
def create_adjustment(
    payload: AdjustmentCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return InventoryService(db).create_adjustment(current_user.tenant_id, current_user.id, payload)


@router.post("/transfers", response_model=StockTxnOut, status_code=status.HTTP_201_CREATED)
def create_transfer(payload: TransferCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_transfer(current_user.tenant_id, current_user.id, payload)


@router.post("/sales", response_model=StockTxnOut, status_code=status.HTTP_201_CREATED)
def create_sale(payload: SaleCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_sale(current_user.tenant_id, current_user.id, payload)


@router.get("/sales/{txn_id}/receipt")
def sale_receipt(txn_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    sale = InventoryService(db).get_txn(current_user.tenant_id, txn_id)
    if sale.txn_type != StockTxnType.SALE:
        raise NotFoundError("Sale not found")
    tenant = db.get(Tenant, current_user.tenant_id)
    data = sale.model_dump(mode="json")
    data["customer_label"] = sale.student_name or sale.customer_name
    pdf = render_sale_receipt(tenant_name=tenant.name if tenant else "School", sale=data)
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{sale.txn_number}.pdf"'},
    )


# ---------- Stock levels ----------
@router.get("/stock", response_model=list[StockLevel])
def stock_levels(
    store_id: uuid.UUID | None = Query(default=None),
    item_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).stock_levels(current_user.tenant_id, store_id, item_id)


@router.get("/stock/low", response_model=list[LowStockRow])
def low_stock(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).low_stock(current_user.tenant_id)


# ---------- Fixed assets ----------
@router.get("/assets", response_model=list[AssetOut])
def list_assets(
    status_filter: AssetStatus | None = Query(default=None, alias="status"),
    as_of: date | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).list_assets(current_user.tenant_id, status_filter, as_of)


@router.post("/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(payload: AssetCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).create_asset(current_user.tenant_id, payload)


@router.get("/assets/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return InventoryService(db).get_asset(current_user.tenant_id, asset_id)


@router.patch("/assets/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: uuid.UUID, payload: AssetUpdate, current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).update_asset(current_user.tenant_id, asset_id, payload)


@router.post("/assets/{asset_id}/dispose", response_model=AssetOut)
def dispose_asset(
    asset_id: uuid.UUID, payload: AssetDispose, current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return InventoryService(db).dispose_asset(current_user.tenant_id, asset_id, payload)
