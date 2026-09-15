import uuid
from datetime import date

from sqlalchemy import select

from app.models.schedule import ClassSchedule, ClassSession
from app.repositories.base import BaseRepository


class ClassScheduleRepository(BaseRepository[ClassSchedule]):
    model = ClassSchedule

    def list_active(self, tenant_id: uuid.UUID) -> list[ClassSchedule]:
        stmt = select(ClassSchedule).where(ClassSchedule.tenant_id == tenant_id, ClassSchedule.is_active.is_(True))
        return list(self.db.execute(stmt).scalars().all())


class ClassSessionRepository(BaseRepository[ClassSession]):
    model = ClassSession

    def exists_for_schedule_date(
        self, tenant_id: uuid.UUID, class_schedule_id: uuid.UUID, session_date: date
    ) -> bool:
        stmt = select(ClassSession.id).where(
            ClassSession.tenant_id == tenant_id,
            ClassSession.class_schedule_id == class_schedule_id,
            ClassSession.session_date == session_date,
        )
        return self.db.execute(stmt).first() is not None

    def list_sessions(
        self,
        tenant_id: uuid.UUID,
        teacher_id: uuid.UUID | None = None,
        section_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[ClassSession]:
        stmt = select(ClassSession).where(ClassSession.tenant_id == tenant_id)
        if teacher_id is not None:
            stmt = stmt.where(ClassSession.teacher_id == teacher_id)
        if section_id is not None:
            stmt = stmt.where(ClassSession.section_id == section_id)
        if date_from is not None:
            stmt = stmt.where(ClassSession.session_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(ClassSession.session_date <= date_to)
        stmt = stmt.order_by(ClassSession.session_date, ClassSession.start_time)
        return list(self.db.execute(stmt).scalars().all())
