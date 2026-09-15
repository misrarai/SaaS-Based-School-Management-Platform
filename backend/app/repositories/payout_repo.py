import uuid

from sqlalchemy import select

from app.models.payout import TeacherPayout, TeacherPayoutRate
from app.repositories.base import BaseRepository


class TeacherPayoutRateRepository(BaseRepository[TeacherPayoutRate]):
    model = TeacherPayoutRate

    def list_active_for_teacher(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> list[TeacherPayoutRate]:
        stmt = (
            select(TeacherPayoutRate)
            .where(
                TeacherPayoutRate.tenant_id == tenant_id,
                TeacherPayoutRate.teacher_id == teacher_id,
                TeacherPayoutRate.is_active.is_(True),
            )
            .order_by(TeacherPayoutRate.effective_from.desc())
        )
        return list(self.db.execute(stmt).scalars().all())


class TeacherPayoutRepository(BaseRepository[TeacherPayout]):
    model = TeacherPayout

    def get_for_teacher_period(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID, period_month: int, period_year: int
    ) -> TeacherPayout | None:
        stmt = select(TeacherPayout).where(
            TeacherPayout.tenant_id == tenant_id,
            TeacherPayout.teacher_id == teacher_id,
            TeacherPayout.period_month == period_month,
            TeacherPayout.period_year == period_year,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_payouts(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID | None = None) -> list[TeacherPayout]:
        stmt = select(TeacherPayout).where(TeacherPayout.tenant_id == tenant_id)
        if teacher_id is not None:
            stmt = stmt.where(TeacherPayout.teacher_id == teacher_id)
        stmt = stmt.order_by(TeacherPayout.period_year.desc(), TeacherPayout.period_month.desc())
        return list(self.db.execute(stmt).scalars().all())
