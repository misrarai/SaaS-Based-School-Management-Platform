import enum
import uuid
from datetime import date as date_

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class StockTxnType(str, enum.Enum):
    PURCHASE = "purchase"
    ISSUE = "issue"
    ADJUSTMENT = "adjustment"
    TRANSFER = "transfer"
    SALE = "sale"


class AssetStatus(str, enum.Enum):
    ACTIVE = "active"
    DISPOSED = "disposed"


class ItemCategory(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "inv_categories"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_inv_category_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class InventoryUnit(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "inv_units"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_inv_unit_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    abbreviation: Mapped[str | None] = mapped_column(String(20), nullable=True)


class Store(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "inv_stores"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_inv_store_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class InventoryItem(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "inv_items"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_inv_item_tenant_code"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("inv_categories.id"), nullable=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("inv_units.id"), nullable=True)
    reorder_level: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    sale_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Supplier(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "inv_suppliers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class StockTransaction(UUIDPKMixin, TimestampMixin, Base):
    """Header for any stock movement document: purchase (stock in), issue (stock out),
    adjustment, inter-store transfer, or point-of-sale sale."""

    __tablename__ = "inv_transactions"
    __table_args__ = (UniqueConstraint("tenant_id", "txn_number", name="uq_inv_txn_tenant_number"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    txn_type: Mapped[StockTxnType] = mapped_column(Enum(StockTxnType), nullable=False, index=True)
    txn_number: Mapped[str] = mapped_column(String(30), nullable=False)
    txn_date: Mapped[date_] = mapped_column(Date, nullable=False)
    store_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("inv_stores.id"), nullable=False)
    to_store_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("inv_stores.id"), nullable=True)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("inv_suppliers.id"), nullable=True)
    invoice_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issued_to_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    issued_to: Mapped[str | None] = mapped_column(String(150), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("student_profiles.id"), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    amount_paid: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)

    lines: Mapped[list["StockTransactionLine"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan", order_by="StockTransactionLine.line_no"
    )


class StockTransactionLine(UUIDPKMixin, Base):
    """`quantity` is always positive; the movement direction per store lives in StockMovement."""

    __tablename__ = "inv_transaction_lines"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("inv_transactions.id"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("inv_items.id"), nullable=False)
    line_no: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    transaction: Mapped[StockTransaction] = relationship(back_populates="lines")


class StockMovement(UUIDPKMixin, Base):
    """Signed per-store quantity ledger; current stock = SUM(quantity) per item per store."""

    __tablename__ = "inv_movements"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    transaction_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("inv_transactions.id"), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("inv_items.id"), nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("inv_stores.id"), nullable=False, index=True)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    movement_date: Mapped[date_] = mapped_column(Date, nullable=False)


class FixedAsset(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "inv_fixed_assets"
    __table_args__ = (UniqueConstraint("tenant_id", "asset_tag", name="uq_inv_asset_tenant_tag"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    asset_tag: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("inv_suppliers.id"), nullable=True)
    purchase_date: Mapped[date_] = mapped_column(Date, nullable=False)
    cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    salvage_value: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    depreciation_rate: Mapped[float] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(150), nullable=True)
    condition: Mapped[str] = mapped_column(String(20), default="good", nullable=False)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), default=AssetStatus.ACTIVE, nullable=False)
    disposal_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    disposal_value: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    disposal_notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
