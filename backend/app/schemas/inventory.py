import uuid
from datetime import date

from pydantic import BaseModel, Field

from app.models.inventory import AssetStatus, StockTxnType


# ---------- Masters ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class CategoryOut(CategoryIn):
    id: uuid.UUID
    model_config = {"from_attributes": True}


class UnitIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    abbreviation: str | None = Field(default=None, max_length=20)


class UnitOut(UnitIn):
    id: uuid.UUID
    model_config = {"from_attributes": True}


class StoreIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    location: str | None = None
    description: str | None = None
    is_active: bool = True


class StoreUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    location: str | None = None
    description: str | None = None
    is_active: bool | None = None


class StoreOut(StoreIn):
    id: uuid.UUID
    model_config = {"from_attributes": True}


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str | None = Field(default=None, max_length=50)
    category_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    reorder_level: float = Field(default=0, ge=0)
    sale_price: float | None = Field(default=None, ge=0)
    description: str | None = None


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    category_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    reorder_level: float | None = Field(default=None, ge=0)
    sale_price: float | None = Field(default=None, ge=0)
    description: str | None = None
    is_active: bool | None = None


class ItemOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    category_id: uuid.UUID | None
    category_name: str | None = None
    unit_id: uuid.UUID | None
    unit_name: str | None = None
    reorder_level: float
    sale_price: float | None
    description: str | None
    is_active: bool
    current_stock: float = 0


class SupplierIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    is_active: bool = True


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    is_active: bool | None = None


class SupplierOut(SupplierIn):
    id: uuid.UUID
    model_config = {"from_attributes": True}


# ---------- Stock transactions ----------
class StockLineIn(BaseModel):
    item_id: uuid.UUID
    quantity: float = Field(gt=0)
    unit_price: float | None = Field(default=None, ge=0)


class PurchaseCreate(BaseModel):
    store_id: uuid.UUID
    supplier_id: uuid.UUID | None = None
    txn_date: date
    invoice_no: str | None = Field(default=None, max_length=50)
    notes: str | None = None
    lines: list[StockLineIn] = Field(min_length=1)


class IssueCreate(BaseModel):
    store_id: uuid.UUID
    txn_date: date
    issued_to_type: str = Field(default="person", pattern="^(department|person|class)$")
    issued_to: str = Field(min_length=1, max_length=150)
    notes: str | None = None
    lines: list[StockLineIn] = Field(min_length=1)


class AdjustmentCreate(BaseModel):
    store_id: uuid.UUID
    txn_date: date
    reason: str = Field(default="damage", pattern="^(damage|loss|expired|found|correction)$")
    direction: str = Field(default="decrease", pattern="^(increase|decrease)$")
    notes: str | None = None
    lines: list[StockLineIn] = Field(min_length=1)


class TransferCreate(BaseModel):
    store_id: uuid.UUID
    to_store_id: uuid.UUID
    txn_date: date
    notes: str | None = None
    lines: list[StockLineIn] = Field(min_length=1)


class SaleCreate(BaseModel):
    store_id: uuid.UUID
    txn_date: date
    student_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=150)
    payment_method: str = Field(default="cash", pattern="^(cash)$")
    discount: float = Field(default=0, ge=0)
    amount_paid: float | None = Field(default=None, ge=0)
    notes: str | None = None
    lines: list[StockLineIn] = Field(min_length=1)


class StockLineOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    item_name: str | None = None
    item_code: str | None = None
    quantity: float
    unit_price: float
    line_total: float


class StockTxnOut(BaseModel):
    id: uuid.UUID
    txn_type: StockTxnType
    txn_number: str
    txn_date: date
    store_id: uuid.UUID
    store_name: str | None = None
    to_store_id: uuid.UUID | None
    to_store_name: str | None = None
    supplier_id: uuid.UUID | None
    supplier_name: str | None = None
    invoice_no: str | None
    issued_to_type: str | None
    issued_to: str | None
    reason: str | None
    student_id: uuid.UUID | None
    student_name: str | None = None
    customer_name: str | None
    payment_method: str | None
    discount: float
    total_amount: float
    amount_paid: float | None
    notes: str | None
    lines: list[StockLineOut]


class StockLevel(BaseModel):
    item_id: uuid.UUID
    item_name: str
    item_code: str
    unit_name: str | None
    store_id: uuid.UUID
    store_name: str
    quantity: float
    reorder_level: float


class LowStockRow(BaseModel):
    item_id: uuid.UUID
    item_name: str
    item_code: str
    unit_name: str | None
    category_name: str | None
    quantity: float
    reorder_level: float
    shortfall: float


# ---------- Fixed assets ----------
class AssetCreate(BaseModel):
    asset_tag: str | None = Field(default=None, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    category: str | None = None
    location: str | None = None
    supplier_id: uuid.UUID | None = None
    purchase_date: date
    cost: float = Field(gt=0)
    salvage_value: float = Field(default=0, ge=0)
    depreciation_rate: float = Field(default=0, ge=0, le=100)
    assigned_to: str | None = None
    condition: str = Field(default="good", pattern="^(new|good|fair|poor|damaged)$")
    notes: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    category: str | None = None
    location: str | None = None
    supplier_id: uuid.UUID | None = None
    purchase_date: date | None = None
    cost: float | None = Field(default=None, gt=0)
    salvage_value: float | None = Field(default=None, ge=0)
    depreciation_rate: float | None = Field(default=None, ge=0, le=100)
    assigned_to: str | None = None
    condition: str | None = Field(default=None, pattern="^(new|good|fair|poor|damaged)$")
    notes: str | None = None


class AssetDispose(BaseModel):
    disposal_date: date
    disposal_value: float = Field(default=0, ge=0)
    disposal_notes: str | None = None


class AssetOut(BaseModel):
    id: uuid.UUID
    asset_tag: str
    name: str
    category: str | None
    location: str | None
    supplier_id: uuid.UUID | None
    purchase_date: date
    cost: float
    salvage_value: float
    depreciation_rate: float
    assigned_to: str | None
    condition: str
    status: AssetStatus
    disposal_date: date | None
    disposal_value: float | None
    disposal_notes: str | None
    notes: str | None
    accumulated_depreciation: float
    book_value: float
    annual_depreciation: float
