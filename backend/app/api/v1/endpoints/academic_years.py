import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.academic import (
    AcademicYearCreate,
    AcademicYearOut,
    AcademicYearUpdate,
    PromoteStudentsRequest,
    PromoteStudentsResult,
)
from app.services.academic_service import AcademicService

router = APIRouter(prefix="/academic-years", tags=["academic-years"])


@router.post("", response_model=AcademicYearOut, status_code=status.HTTP_201_CREATED)
def create_academic_year(
    payload: AcademicYearCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> AcademicYearOut:
    return AcademicService(db).create_academic_year(current_user.tenant_id, payload)


@router.get("", response_model=list[AcademicYearOut])
def list_academic_years(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[AcademicYearOut]:
    return AcademicService(db).list_academic_years(current_user.tenant_id)


@router.patch("/{year_id}", response_model=AcademicYearOut)
def update_academic_year(
    year_id: uuid.UUID,
    payload: AcademicYearUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> AcademicYearOut:
    return AcademicService(db).update_academic_year(current_user.tenant_id, year_id, payload)


@router.post("/promote", response_model=PromoteStudentsResult)
def promote_students(
    payload: PromoteStudentsRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> PromoteStudentsResult:
    return AcademicService(db).promote_students(current_user.tenant_id, payload)
