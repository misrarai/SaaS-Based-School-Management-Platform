import uuid

from sqlalchemy import func, select

from app.models.transport import (
    TransportAllocation,
    TransportDriver,
    TransportFeeRecord,
    TransportRoute,
    TransportStop,
    TransportVehicle,
)
from app.repositories.base import BaseRepository


class TransportDriverRepository(BaseRepository[TransportDriver]):
    model = TransportDriver

    def list_ordered(self, tenant_id: uuid.UUID) -> list[TransportDriver]:
        stmt = select(TransportDriver).where(TransportDriver.tenant_id == tenant_id).order_by(TransportDriver.full_name)
        return list(self.db.execute(stmt).scalars().all())


class TransportVehicleRepository(BaseRepository[TransportVehicle]):
    model = TransportVehicle

    def list_ordered(self, tenant_id: uuid.UUID) -> list[TransportVehicle]:
        stmt = (
            select(TransportVehicle)
            .where(TransportVehicle.tenant_id == tenant_id)
            .order_by(TransportVehicle.registration_number)
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_by_registration(self, tenant_id: uuid.UUID, registration: str) -> TransportVehicle | None:
        stmt = select(TransportVehicle).where(
            TransportVehicle.tenant_id == tenant_id,
            func.lower(TransportVehicle.registration_number) == registration.lower(),
        )
        return self.db.execute(stmt).scalars().first()

    def count_for_driver(self, tenant_id: uuid.UUID, driver_id: uuid.UUID) -> int:
        stmt = select(func.count(TransportVehicle.id)).where(
            TransportVehicle.tenant_id == tenant_id, TransportVehicle.driver_id == driver_id
        )
        return int(self.db.execute(stmt).scalar_one())


class TransportRouteRepository(BaseRepository[TransportRoute]):
    model = TransportRoute

    def list_ordered(self, tenant_id: uuid.UUID) -> list[TransportRoute]:
        stmt = select(TransportRoute).where(TransportRoute.tenant_id == tenant_id).order_by(TransportRoute.name)
        return list(self.db.execute(stmt).scalars().all())

    def list_for_vehicle(self, tenant_id: uuid.UUID, vehicle_id: uuid.UUID) -> list[TransportRoute]:
        stmt = select(TransportRoute).where(
            TransportRoute.tenant_id == tenant_id, TransportRoute.vehicle_id == vehicle_id
        )
        return list(self.db.execute(stmt).scalars().all())


class TransportStopRepository(BaseRepository[TransportStop]):
    model = TransportStop

    def list_for_routes(self, tenant_id: uuid.UUID, route_ids: list[uuid.UUID]) -> list[TransportStop]:
        if not route_ids:
            return []
        stmt = (
            select(TransportStop)
            .where(TransportStop.tenant_id == tenant_id, TransportStop.route_id.in_(route_ids))
            .order_by(TransportStop.stop_order, TransportStop.name)
        )
        return list(self.db.execute(stmt).scalars().all())


class TransportAllocationRepository(BaseRepository[TransportAllocation]):
    model = TransportAllocation

    def search(
        self,
        tenant_id: uuid.UUID,
        route_id: uuid.UUID | None = None,
        status: str | None = None,
        student_ids: list[uuid.UUID] | None = None,
        stop_id: uuid.UUID | None = None,
    ) -> list[TransportAllocation]:
        stmt = select(TransportAllocation).where(TransportAllocation.tenant_id == tenant_id)
        if route_id is not None:
            stmt = stmt.where(TransportAllocation.route_id == route_id)
        if stop_id is not None:
            stmt = stmt.where(TransportAllocation.stop_id == stop_id)
        if status and status != "all":
            stmt = stmt.where(TransportAllocation.status == status)
        if student_ids is not None:
            stmt = stmt.where(TransportAllocation.student_id.in_(student_ids))
        stmt = stmt.order_by(TransportAllocation.start_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def active_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> TransportAllocation | None:
        stmt = select(TransportAllocation).where(
            TransportAllocation.tenant_id == tenant_id,
            TransportAllocation.student_id == student_id,
            TransportAllocation.status == "active",
        )
        return self.db.execute(stmt).scalars().first()

    def count_active_for_routes(self, tenant_id: uuid.UUID, route_ids: list[uuid.UUID]) -> int:
        if not route_ids:
            return 0
        stmt = select(func.count(TransportAllocation.id)).where(
            TransportAllocation.tenant_id == tenant_id,
            TransportAllocation.route_id.in_(route_ids),
            TransportAllocation.status == "active",
        )
        return int(self.db.execute(stmt).scalar_one())


class TransportFeeRecordRepository(BaseRepository[TransportFeeRecord]):
    model = TransportFeeRecord

    def get_for_period(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, month: int, year: int
    ) -> TransportFeeRecord | None:
        stmt = select(TransportFeeRecord).where(
            TransportFeeRecord.tenant_id == tenant_id,
            TransportFeeRecord.student_id == student_id,
            TransportFeeRecord.period_month == month,
            TransportFeeRecord.period_year == year,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def search(self, tenant_id: uuid.UUID, month: int | None = None, year: int | None = None) -> list[TransportFeeRecord]:
        stmt = select(TransportFeeRecord).where(TransportFeeRecord.tenant_id == tenant_id)
        if month is not None:
            stmt = stmt.where(TransportFeeRecord.period_month == month)
        if year is not None:
            stmt = stmt.where(TransportFeeRecord.period_year == year)
        stmt = stmt.order_by(TransportFeeRecord.period_year.desc(), TransportFeeRecord.period_month.desc())
        return list(self.db.execute(stmt).scalars().all())
