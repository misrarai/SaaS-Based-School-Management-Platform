import enum
import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class InvoiceType(str, enum.Enum):
    TUITION = "tuition"
    ADMISSION = "admission"
    OTHER = "other"


class InvoiceStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    WAIVED = "waived"


class PaymentMethod(str, enum.Enum):
    JAZZCASH = "jazzcash"
    EASYPAISA = "easypaisa"
    NAYAPAY = "nayapay"
    SADAPAY = "sadapay"
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    OTHER = "other"


class PaymentVerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class FeePlan(UUIDPKMixin, TimestampMixin, Base):
    """Monthly tuition price for a class in a given academic year."""

    __tablename__ = "fee_plans"
    __table_args__ = (
        UniqueConstraint("tenant_id", "class_grade_id", "academic_year", name="uq_fee_plan_tenant_class_year"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("class_grades.id"), nullable=False, index=True
    )
    academic_year: Mapped[str] = mapped_column(String(20), nullable=False)
    monthly_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)


class Invoice(UUIDPKMixin, TimestampMixin, Base):
    """A single bill owed by a student — a monthly tuition period, an admission fee, or a
    one-off other charge. discount_amount is a snapshot taken at generation time (from the
    student's admission-detail discount + referral discount), so later edits to those fields
    never retroactively change an already-issued invoice."""

    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "student_id",
            "invoice_type",
            "period_month",
            "period_year",
            name="uq_invoice_tenant_student_type_period",
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    class_grade_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("class_grades.id"), nullable=False, index=True
    )
    invoice_type: Mapped[InvoiceType] = mapped_column(Enum(InvoiceType), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(20), nullable=False)
    period_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount_due: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    due_date: Mapped[date_] = mapped_column(Date, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.PENDING, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Payment(UUIDPKMixin, TimestampMixin, Base):
    """A parent-submitted payment against an invoice — a manual receipt (JazzCash/EasyPaisa/
    bank transfer screenshot) or a cash note, pending admin verification. No payment-gateway
    integration; this is a verification workflow around an uploaded receipt image."""

    __tablename__ = "payments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("invoices.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    reference_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    receipt_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verification_status: Mapped[PaymentVerificationStatus] = mapped_column(
        Enum(PaymentVerificationStatus), default=PaymentVerificationStatus.PENDING, nullable=False
    )
    verified_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
