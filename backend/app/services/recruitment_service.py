import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.recruitment import JobApplication, JobVacancy
from app.repositories.recruitment_repo import ApplicationRepository, VacancyRepository
from app.schemas.recruitment import (
    ApplicationCreate,
    ApplicationUpdate,
    VacancyCreate,
    VacancyUpdate,
)


class RecruitmentService:
    def __init__(self, db: Session):
        self.db = db
        self.vacancies = VacancyRepository(db)
        self.applications = ApplicationRepository(db)

    # ---------- vacancies ----------
    def _vacancy_out(self, v: JobVacancy, apps: dict, hired: dict) -> dict:
        return {
            "id": v.id, "title": v.title, "department": v.department, "description": v.description,
            "positions": v.positions, "posted_date": v.posted_date, "status": v.status,
            "application_count": apps.get(v.id, 0), "hired_count": hired.get(v.id, 0),
        }

    def list_vacancies(self, tenant_id: uuid.UUID, status: str | None = None) -> list[dict]:
        apps = self.vacancies.application_counts(tenant_id)
        hired = self.vacancies.hired_counts(tenant_id)
        return [self._vacancy_out(v, apps, hired) for v in self.vacancies.list_all(tenant_id, status)]

    def create_vacancy(self, tenant_id: uuid.UUID, payload: VacancyCreate) -> dict:
        data = payload.model_dump()
        data["posted_date"] = data.get("posted_date") or date.today()
        v = self.vacancies.create(JobVacancy(tenant_id=tenant_id, **data))
        self.db.commit()
        return self._vacancy_out(v, {}, {})

    def update_vacancy(self, tenant_id: uuid.UUID, vacancy_id: uuid.UUID, payload: VacancyUpdate) -> dict:
        v = self.vacancies.get_by_id(tenant_id, vacancy_id)
        if v is None:
            raise NotFoundError("Vacancy not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(v, field, value)
        self.db.commit()
        return self._vacancy_out(v, self.vacancies.application_counts(tenant_id), self.vacancies.hired_counts(tenant_id))

    # ---------- applications ----------
    def _vacancy_titles(self, tenant_id: uuid.UUID) -> dict:
        return {v.id: v.title for v in self.vacancies.list_all(tenant_id)}

    def _app_out(self, a: JobApplication, titles: dict) -> dict:
        return {
            "id": a.id, "vacancy_id": a.vacancy_id, "vacancy_title": titles.get(a.vacancy_id),
            "candidate_name": a.candidate_name, "email": a.email, "phone": a.phone, "qualification": a.qualification,
            "experience_years": a.experience_years, "resume_url": a.resume_url, "applied_date": a.applied_date,
            "stage": a.stage, "interview_at": a.interview_at, "interviewer": a.interviewer,
            "interview_result": a.interview_result, "interview_feedback": a.interview_feedback, "notes": a.notes,
        }

    def list_applications(self, tenant_id: uuid.UUID, vacancy_id=None, stage=None) -> list[dict]:
        titles = self._vacancy_titles(tenant_id)
        return [self._app_out(a, titles) for a in self.applications.search(tenant_id, vacancy_id, stage)]

    def create_application(self, tenant_id: uuid.UUID, payload: ApplicationCreate) -> dict:
        if self.vacancies.get_by_id(tenant_id, payload.vacancy_id) is None:
            raise NotFoundError("Vacancy not found")
        a = self.applications.create(JobApplication(tenant_id=tenant_id, applied_date=date.today(), **payload.model_dump()))
        self.db.commit()
        return self._app_out(a, self._vacancy_titles(tenant_id))

    def update_application(self, tenant_id: uuid.UUID, application_id: uuid.UUID, payload: ApplicationUpdate) -> dict:
        a = self.applications.get_by_id(tenant_id, application_id)
        if a is None:
            raise NotFoundError("Application not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(a, field, value)
        self.db.commit()
        return self._app_out(a, self._vacancy_titles(tenant_id))
