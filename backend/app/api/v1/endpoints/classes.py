import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.academic import (
    ClassGradeCreate,
    ClassGradeOut,
    SectionCreate,
    SectionOut,
    SubjectCreate,
    SubjectOut,
)
from app.services.academic_service import AcademicService

router = APIRouter(tags=["academic-structure"])


@router.post("/classes", response_model=ClassGradeOut, status_code=status.HTTP_201_CREATED)
def create_class(
    payload: ClassGradeCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> ClassGradeOut:
    return AcademicService(db).create_class_grade(current_user.tenant_id, payload)


@router.get("/classes", response_model=list[ClassGradeOut])
def list_classes(
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[ClassGradeOut]:
    return AcademicService(db).list_class_grades(current_user.tenant_id)


@router.post("/classes/{class_id}/sections", response_model=SectionOut, status_code=status.HTTP_201_CREATED)
def create_section(
    class_id: uuid.UUID,
    payload: SectionCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> SectionOut:
    return AcademicService(db).create_section(current_user.tenant_id, class_id, payload)


@router.get("/classes/{class_id}/sections", response_model=list[SectionOut])
def list_sections(
    class_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[SectionOut]:
    return AcademicService(db).list_sections(current_user.tenant_id, class_id)


@router.post("/classes/{class_id}/subjects", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    class_id: uuid.UUID,
    payload: SubjectCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> SubjectOut:
    return AcademicService(db).create_subject(current_user.tenant_id, class_id, payload)


@router.get("/classes/{class_id}/subjects", response_model=list[SubjectOut])
def list_subjects(
    class_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[SubjectOut]:
    return AcademicService(db).list_subjects(current_user.tenant_id, class_id)
