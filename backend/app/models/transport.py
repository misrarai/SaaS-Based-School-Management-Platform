"""Transport module: vehicles, drivers, routes & stops, student allocations and the link table
that records which monthly transport invoices have already been issued (so re-running the
monthly generation never double-bills a student)."""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class TransportDriver(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "transport_drivers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    staff_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("staff.id"), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cnic: Mapped[str | None] = mapped_column(String(30), nullable=True)
    license_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    license_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    salary: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)


class TransportVehicle(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "transport_vehicles"
    __table_args__ = (
        UniqueConstraint("tenant_id", "registration_number", name="uq_transport_vehicle_tenant_reg"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    registration_number: Mapped[str] = mapped_column(String(30), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(20), default="bus", nullable=False)  # bus | van | car
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    insurance_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    fitness_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    driver_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("transport_drivers.id"), nullable=True, index=True
    )
    conductor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    conductor_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)


class TransportRoute(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "transport_routes"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("transport_vehicles.id"), nullable=True, index=True
    )
    start_point: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)


class TransportStop(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "transport_stops"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    route_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("transport_routes.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    stop_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    pickup_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM"
    drop_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    monthly_fare: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)


class TransportAllocation(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "transport_allocations"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    route_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("transport_routes.id"), nullable=False, index=True)
    stop_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("transport_stops.id"), nullable=False)
    pickup_type: Mapped[str] = mapped_column(String(20), default="both", nullable=False)  # both|pickup|drop
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)  # active|inactive
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)


class TransportFeeRecord(UUIDPKMixin, TimestampMixin, Base):
    """One row per student per billed month — the dedupe key for monthly transport invoices."""

    __tablename__ = "transport_fee_records"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "student_id", "period_month", "period_year", name="uq_transport_fee_student_period"
        ),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    allocation_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("transport_allocations.id"), nullable=False
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("invoices.id"), nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
