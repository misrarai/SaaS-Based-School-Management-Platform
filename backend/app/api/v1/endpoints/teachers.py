import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.teacher import TeacherCreate, TeacherOut, TeacherUpdate
from app.services.teacher_service import TeacherService

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.post("", response_model=TeacherOut, status_code=status.HTTP_201_CREATED)
def create_teacher(
    payload: TeacherCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> TeacherOut:
    return TeacherService(db).create_teacher(current_user.tenant_id, payload)


@router.get("", response_model=list[TeacherOut])
def list_teachers(
    q: str | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[TeacherOut]:
    return TeacherService(db).list_teachers(current_user.tenant_id, q)


@router.get("/{teacher_id}", response_model=TeacherOut)
def get_teacher(
    teacher_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> TeacherOut:
    return TeacherService(db).get_teacher(current_user.tenant_id, teacher_id)


@router.patch("/{teacher_id}", response_model=TeacherOut)
def update_teacher(
    teacher_id: uuid.UUID,
    payload: TeacherUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> TeacherOut:
    return TeacherService(db).update_teacher(current_user.tenant_id, teacher_id, payload)
