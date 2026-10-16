"""Fee heads, per-class fee structures, invoice line items, concessions, late-fee rules and
counter receipts — the itemised-billing / cash-desk layer on top of app/models/fee.py."""

import enum
import uuid
from datetime import date as date_

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.fee import PaymentMethod
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class FeeFrequency(str, enum.Enum):
    MONTHLY = "monthly"
    ONE_TIME = "one_time"
    ANNUAL = "annual"
    PER_TERM = "per_term"


class ConcessionType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class FeeHead(UUIDPKMixin, TimestampMixin, Base):
    """A configurable charge category (Tuition, Admission, Exam, Transport, Lab, Fine…)."""

    __tablename__ = "fee_heads"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_fee_head_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    default_frequency: Mapped[FeeFrequency] = mapped_column(
        Enum(FeeFrequency), nullable=False, default=FeeFrequency.MONTHLY
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class FeeStructureItem(UUIDPKMixin, TimestampMixin, Base):
    """One head + amount + frequency inside a class's fee structure."""

    __tablename__ = "fee_structure_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "class_grade_id", "fee_head_id", name="uq_fee_structure_class_head"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("class_grades.id"), nullable=False, index=True
    )
    fee_head_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("fee_heads.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    frequency: Mapped[FeeFrequency] = mapped_column(Enum(FeeFrequency), nullable=False)


class InvoiceLine(UUIDPKMixin, TimestampMixin, Base):
    """A line item on an invoice/voucher. amount is the gross charge; concession_amount is the
    per-line concession snapshot taken at generation time. Invoices created before line items
    existed simply have none."""

    __tablename__ = "invoice_lines"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("invoices.id"), nullable=False, index=True)
    fee_head_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("fee_heads.id"), nullable=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    concession_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0, server_default="0")


class FeeConcession(UUIDPKMixin, TimestampMixin, Base):
    """Per-student concession/scholarship. fee_head_id NULL means it applies to the whole
    invoice (overall); otherwise only to lines of that head."""

    __tablename__ = "fee_concessions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    fee_head_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("fee_heads.id"), nullable=True)
    concession_type: Mapped[ConcessionType] = mapped_column(Enum(ConcessionType), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    valid_from: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LateFeeRule(UUIDPKMixin, TimestampMixin, Base):
    """Per-tenant fixed late-payment fine, charged once per invoice once it is more than
    grace_days past its due date."""

    __tablename__ = "late_fee_rules"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_late_fee_rule_tenant"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    grace_days: Mapped[int] = mapped_column(nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class FeeReceipt(UUIDPKMixin, TimestampMixin, Base):
    """A cash-desk collection: one receipt, one or more VERIFIED payments (Payment.receipt_id)
    allocated oldest-invoice-first across a family's/student's open invoices."""

    __tablename__ = "fee_receipts"
    __table_args__ = (UniqueConstraint("tenant_id", "receipt_number", name="uq_fee_receipt_tenant_number"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    receipt_number: Mapped[str] = mapped_column(String(30), nullable=False)
    family_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("families.id"), nullable=True, index=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=True, index=True
    )
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    collected_on: Mapped[date_] = mapped_column(Date, nullable=False, index=True)
    collected_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    reference_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
