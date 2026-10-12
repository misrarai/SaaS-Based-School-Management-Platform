import uuid

from sqlalchemy import func, select

from app.models.recruitment import JobApplication, JobVacancy
from app.repositories.base import BaseRepository


class VacancyRepository(BaseRepository[JobVacancy]):
    model = JobVacancy

    def list_all(self, tenant_id: uuid.UUID, status: str | None = None) -> list[JobVacancy]:
        stmt = select(JobVacancy).where(JobVacancy.tenant_id == tenant_id)
        if status and status != "all":
            stmt = stmt.where(JobVacancy.status == status)
        return list(self.db.execute(stmt.order_by(JobVacancy.posted_date.desc())).scalars().all())

    def application_counts(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, int]:
        stmt = select(JobApplication.vacancy_id, func.count(JobApplication.id)).where(JobApplication.tenant_id == tenant_id).group_by(JobApplication.vacancy_id)
        return {row[0]: row[1] for row in self.db.execute(stmt).all()}

    def hired_counts(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, int]:
        stmt = select(JobApplication.vacancy_id, func.count(JobApplication.id)).where(JobApplication.tenant_id == tenant_id, JobApplication.stage == "hired").group_by(JobApplication.vacancy_id)
        return {row[0]: row[1] for row in self.db.execute(stmt).all()}


class ApplicationRepository(BaseRepository[JobApplication]):
    model = JobApplication

    def search(self, tenant_id: uuid.UUID, vacancy_id: uuid.UUID | None = None, stage: str | None = None) -> list[JobApplication]:
        stmt = select(JobApplication).where(JobApplication.tenant_id == tenant_id)
        if vacancy_id:
            stmt = stmt.where(JobApplication.vacancy_id == vacancy_id)
        if stage and stage != "all":
            stmt = stmt.where(JobApplication.stage == stage)
        return list(self.db.execute(stmt.order_by(JobApplication.applied_date.desc())).scalars().all())
