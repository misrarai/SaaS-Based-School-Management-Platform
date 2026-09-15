import enum
import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class PayoutRateType(str, enum.Enum):
    PER_SESSION = "per_session"
    REVENUE_SHARE_PERCENT = "revenue_share_percent"


class PayoutStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    PAID = "paid"


class TeacherPayoutRate(UUIDPKMixin, TimestampMixin, Base):
    """subject_id is informational only for now — rate resolution just picks the most
    recently effective active rate for a teacher, not per-subject. Revisit if a school
    ever needs different rates for different subjects a teacher teaches."""

    __tablename__ = "teacher_payout_rates"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=True)
    rate_type: Mapped[PayoutRateType] = mapped_column(Enum(PayoutRateType), nullable=False)
    rate_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    effective_from: Mapped[date_] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class TeacherPayout(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "teacher_payouts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "teacher_id", "period_month", "period_year", name="uq_payout_teacher_period"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=False, index=True
    )
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    sessions_delivered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    calculated_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[PayoutStatus] = mapped_column(Enum(PayoutStatus), default=PayoutStatus.DRAFT, nullable=False)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
