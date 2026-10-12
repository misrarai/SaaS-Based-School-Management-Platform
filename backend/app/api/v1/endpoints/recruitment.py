import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.recruitment import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    VacancyCreate,
    VacancyOut,
    VacancyUpdate,
)
from app.services.recruitment_service import RecruitmentService

router = APIRouter(prefix="/recruitment", tags=["recruitment"])
admin_only = require_role(RoleEnum.ADMIN)


@router.get("/vacancies", response_model=list[VacancyOut])
def list_vacancies(status_filter: str | None = Query(default=None, alias="status"), current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return RecruitmentService(db).list_vacancies(current_user.tenant_id, status_filter)


@router.post("/vacancies", response_model=VacancyOut, status_code=status.HTTP_201_CREATED)
def create_vacancy(payload: VacancyCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return RecruitmentService(db).create_vacancy(current_user.tenant_id, payload)


@router.patch("/vacancies/{vacancy_id}", response_model=VacancyOut)
def update_vacancy(vacancy_id: uuid.UUID, payload: VacancyUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return RecruitmentService(db).update_vacancy(current_user.tenant_id, vacancy_id, payload)


@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(
    vacancy_id: uuid.UUID | None = Query(default=None),
    stage: str | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return RecruitmentService(db).list_applications(current_user.tenant_id, vacancy_id, stage)


@router.post("/applications", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(payload: ApplicationCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return RecruitmentService(db).create_application(current_user.tenant_id, payload)


@router.patch("/applications/{application_id}", response_model=ApplicationOut)
def update_application(application_id: uuid.UUID, payload: ApplicationUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return RecruitmentService(db).update_application(current_user.tenant_id, application_id, payload)
