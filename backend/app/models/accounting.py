import enum
import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    INCOME = "income"
    EXPENSE = "expense"


class VoucherType(str, enum.Enum):
    CRV = "CRV"  # cash receipt
    CPV = "CPV"  # cash payment
    BRV = "BRV"  # bank receipt
    BPV = "BPV"  # bank payment
    JV = "JV"  # journal


class VoucherStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"


class PeriodStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class Account(UUIDPKMixin, TimestampMixin, Base):
    """Chart-of-accounts node. `subtype` marks cash/bank accounts (used by quick entries
    and to pick CPV/BPV vs CRV/BRV voucher types)."""

    __tablename__ = "acc_accounts"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_acc_account_tenant_code"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("acc_accounts.id"), nullable=True)
    subtype: Mapped[str | None] = mapped_column(String(20), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Voucher(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "acc_vouchers"
    __table_args__ = (UniqueConstraint("tenant_id", "voucher_number", name="uq_acc_voucher_tenant_number"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    voucher_type: Mapped[VoucherType] = mapped_column(Enum(VoucherType), nullable=False)
    voucher_number: Mapped[str] = mapped_column(String(30), nullable=False)
    voucher_date: Mapped[date_] = mapped_column(Date, nullable=False, index=True)
    narration: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payee: Mapped[str | None] = mapped_column(String(150), nullable=True)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[VoucherStatus] = mapped_column(Enum(VoucherStatus), default=VoucherStatus.DRAFT, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    reversal_of_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("acc_vouchers.id"), nullable=True)
    reversed_by_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("acc_vouchers.id"), nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)

    lines: Mapped[list["VoucherLine"]] = relationship(
        back_populates="voucher", cascade="all, delete-orphan", order_by="VoucherLine.line_no"
    )


class VoucherLine(UUIDPKMixin, Base):
    __tablename__ = "acc_voucher_lines"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    voucher_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("acc_vouchers.id"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("acc_accounts.id"), nullable=False, index=True)
    line_no: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    debit: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    credit: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    voucher: Mapped[Voucher] = relationship(back_populates="lines")


class FinancialPeriod(UUIDPKMixin, TimestampMixin, Base):
    """A month that has been explicitly opened/closed. Months with no row are open."""

    __tablename__ = "acc_periods"
    __table_args__ = (UniqueConstraint("tenant_id", "year", "month", name="uq_acc_period_tenant_month"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PeriodStatus] = mapped_column(Enum(PeriodStatus), default=PeriodStatus.OPEN, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class AccountingSourceLink(UUIDPKMixin, TimestampMixin, Base):
    """Idempotency link between an operational record (fee payment, payout) and its voucher."""

    __tablename__ = "acc_source_links"
    __table_args__ = (
        UniqueConstraint("tenant_id", "source_type", "source_id", name="uq_acc_source_link"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)
    voucher_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("acc_vouchers.id"), nullable=False)
