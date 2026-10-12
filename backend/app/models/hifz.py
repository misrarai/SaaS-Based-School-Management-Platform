"""Hifz (Quran memorization): halqas (circles), student enrolments with progress, and daily
records of sabaq (new lesson), sabqi (recent revision) and manzil (old revision). Tenant-scoped."""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin

ENROLMENT_STATUSES = ("active", "completed", "left")
HIFZ_GRADES = ("excellent", "good", "fair", "weak")


class Halqa(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hifz_halqas"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    incharge: Mapped[str | None] = mapped_column(String(150), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class HifzEnrolment(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hifz_enrolments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    halqa_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hifz_halqas.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    current_juz: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # 1..30
    current_page: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    records: Mapped[list["HifzDailyRecord"]] = relationship(
        back_populates="enrolment", cascade="all, delete-orphan", order_by="HifzDailyRecord.record_date.desc()"
    )


class HifzDailyRecord(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hifz_daily_records"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    enrolment_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("hifz_enrolments.id"), nullable=False, index=True
    )
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    sabaq: Mapped[str | None] = mapped_column(String(255), nullable=True)   # new lesson
    sabqi: Mapped[str | None] = mapped_column(String(255), nullable=True)   # recent revision
    manzil: Mapped[str | None] = mapped_column(String(255), nullable=True)  # old revision
    grade: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mistakes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    enrolment: Mapped[HifzEnrolment] = relationship(back_populates="records")


SPONSORSHIP_STATUSES = ("active", "ended")


class Donor(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hifz_donors"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class Donation(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hifz_donations"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    donor_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hifz_donors.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    donation_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    purpose: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Sponsorship(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hifz_sponsorships"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    donor_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hifz_donors.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    monthly_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
