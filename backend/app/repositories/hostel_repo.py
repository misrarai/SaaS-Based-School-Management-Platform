import uuid

from sqlalchemy import func, select

from app.models.hostel import (
    Hostel,
    HostelAllocation,
    HostelFeeRecord,
    HostelMessMenu,
    HostelOutpass,
    HostelRoom,
)
from app.repositories.base import BaseRepository


class HostelRepository(BaseRepository[Hostel]):
    model = Hostel

    def list_ordered(self, tenant_id: uuid.UUID) -> list[Hostel]:
        stmt = select(Hostel).where(Hostel.tenant_id == tenant_id).order_by(Hostel.name)
        return list(self.db.execute(stmt).scalars().all())


class HostelRoomRepository(BaseRepository[HostelRoom]):
    model = HostelRoom

    def search(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID | None = None) -> list[HostelRoom]:
        stmt = select(HostelRoom).where(HostelRoom.tenant_id == tenant_id)
        if hostel_id is not None:
            stmt = stmt.where(HostelRoom.hostel_id == hostel_id)
        stmt = stmt.order_by(HostelRoom.room_number)
        return list(self.db.execute(stmt).scalars().all())

    def get_by_number(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID, room_number: str) -> HostelRoom | None:
        stmt = select(HostelRoom).where(
            HostelRoom.tenant_id == tenant_id,
            HostelRoom.hostel_id == hostel_id,
            func.lower(HostelRoom.room_number) == room_number.lower(),
        )
        return self.db.execute(stmt).scalars().first()


class HostelAllocationRepository(BaseRepository[HostelAllocation]):
    model = HostelAllocation

    def search(
        self,
        tenant_id: uuid.UUID,
        hostel_id: uuid.UUID | None = None,
        room_id: uuid.UUID | None = None,
        status: str | None = None,
        student_ids: list[uuid.UUID] | None = None,
    ) -> list[HostelAllocation]:
        stmt = select(HostelAllocation).where(HostelAllocation.tenant_id == tenant_id)
        if hostel_id is not None:
            stmt = stmt.where(HostelAllocation.hostel_id == hostel_id)
        if room_id is not None:
            stmt = stmt.where(HostelAllocation.room_id == room_id)
        if status and status != "all":
            stmt = stmt.where(HostelAllocation.status == status)
        if student_ids is not None:
            stmt = stmt.where(HostelAllocation.student_id.in_(student_ids))
        stmt = stmt.order_by(HostelAllocation.from_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def active_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> HostelAllocation | None:
        stmt = select(HostelAllocation).where(
            HostelAllocation.tenant_id == tenant_id,
            HostelAllocation.student_id == student_id,
            HostelAllocation.status == "active",
        )
        return self.db.execute(stmt).scalars().first()

    def count_active_by_room(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, int]:
        stmt = (
            select(HostelAllocation.room_id, func.count(HostelAllocation.id))
            .where(HostelAllocation.tenant_id == tenant_id, HostelAllocation.status == "active")
            .group_by(HostelAllocation.room_id)
        )
        return {row[0]: int(row[1]) for row in self.db.execute(stmt).all()}


class HostelFeeRecordRepository(BaseRepository[HostelFeeRecord]):
    model = HostelFeeRecord

    def get_for_period(self, tenant_id: uuid.UUID, student_id: uuid.UUID, month: int, year: int) -> HostelFeeRecord | None:
        stmt = select(HostelFeeRecord).where(
            HostelFeeRecord.tenant_id == tenant_id,
            HostelFeeRecord.student_id == student_id,
            HostelFeeRecord.period_month == month,
            HostelFeeRecord.period_year == year,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def search(self, tenant_id: uuid.UUID, month: int | None = None, year: int | None = None) -> list[HostelFeeRecord]:
        stmt = select(HostelFeeRecord).where(HostelFeeRecord.tenant_id == tenant_id)
        if month is not None:
            stmt = stmt.where(HostelFeeRecord.period_month == month)
        if year is not None:
            stmt = stmt.where(HostelFeeRecord.period_year == year)
        stmt = stmt.order_by(HostelFeeRecord.period_year.desc(), HostelFeeRecord.period_month.desc())
        return list(self.db.execute(stmt).scalars().all())


class HostelMessMenuRepository(BaseRepository[HostelMessMenu]):
    model = HostelMessMenu

    def list_for_hostel(self, tenant_id: uuid.UUID, hostel_id: uuid.UUID | None) -> list[HostelMessMenu]:
        stmt = select(HostelMessMenu).where(HostelMessMenu.tenant_id == tenant_id)
        if hostel_id is None:
            stmt = stmt.where(HostelMessMenu.hostel_id.is_(None))
        else:
            stmt = stmt.where(HostelMessMenu.hostel_id == hostel_id)
        stmt = stmt.order_by(HostelMessMenu.day_of_week)
        return list(self.db.execute(stmt).scalars().all())


class HostelOutpassRepository(BaseRepository[HostelOutpass]):
    model = HostelOutpass

    def search(
        self,
        tenant_id: uuid.UUID,
        status: str | None = None,
        student_ids: list[uuid.UUID] | None = None,
    ) -> list[HostelOutpass]:
        stmt = select(HostelOutpass).where(HostelOutpass.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(HostelOutpass.status == status)
        if student_ids is not None:
            stmt = stmt.where(HostelOutpass.student_id.in_(student_ids))
        stmt = stmt.order_by(HostelOutpass.out_at.desc())
        return list(self.db.execute(stmt).scalars().all())
