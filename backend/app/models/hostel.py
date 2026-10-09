"""Hostel module: hostels, rooms, student room allocations, monthly hostel-fee dedupe records,
the weekly mess menu and student outpasses (leave out of hostel)."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class Hostel(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hostels"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    hostel_type: Mapped[str] = mapped_column(String(10), default="boys", nullable=False)  # boys|girls|mixed
    warden_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    warden_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)


class HostelRoom(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hostel_rooms"
    __table_args__ = (UniqueConstraint("hostel_id", "room_number", name="uq_hostel_room_number"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    hostel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hostels.id"), nullable=False, index=True)
    room_number: Mapped[str] = mapped_column(String(30), nullable=False)
    floor: Mapped[str | None] = mapped_column(String(30), nullable=True)
    room_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. single, double, dormitory
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)


class HostelAllocation(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "hostel_allocations"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    hostel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hostels.id"), nullable=False, index=True)
    room_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hostel_rooms.id"), nullable=False, index=True)
    bed_label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active|vacated
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)


class HostelFeeRecord(UUIDPKMixin, TimestampMixin, Base):
    """One row per student per billed month — the dedupe key for monthly hostel invoices."""

    __tablename__ = "hostel_fee_records"
    __table_args__ = (
        UniqueConstraint("tenant_id", "student_id", "period_month", "period_year", name="uq_hostel_fee_student_period"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    allocation_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("hostel_allocations.id"), nullable=False)
    invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("invoices.id"), nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)


class HostelMessMenu(UUIDPKMixin, TimestampMixin, Base):
    """Weekly mess menu. hostel_id NULL means the menu applies to every hostel of the school."""

    __tablename__ = "hostel_mess_menus"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    hostel_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("hostels.id"), nullable=True, index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 = Monday … 6 = Sunday
    breakfast: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lunch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dinner: Mapped[str | None] = mapped_column(String(255), nullable=True)


class HostelOutpass(UUIDPKMixin, TimestampMixin, Base):
    """A student's leave out of the hostel — requested, approved/rejected, then closed on return."""

    __tablename__ = "hostel_outpasses"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    hostel_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("hostels.id"), nullable=True)
    out_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expected_return_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_return_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    visitor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)  # who picks the student up
    visitor_relation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    # pending | approved | rejected | returned
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    approved_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(255), nullable=True)
