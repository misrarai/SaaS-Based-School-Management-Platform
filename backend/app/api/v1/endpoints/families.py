import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.repositories.family_repo import FamilyRepository
from app.schemas.family import FamilyCreate, FamilyOut, FamilyUpdate
from app.schemas.student import StudentOut
from app.services.family_service import FamilyService
from app.services.student_service import StudentService

router = APIRouter(prefix="/families", tags=["families"])


@router.post("", response_model=FamilyOut, status_code=status.HTTP_201_CREATED)
def create_family(
    payload: FamilyCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> FamilyOut:
    return FamilyService(db).create_family(current_user.tenant_id, payload)


@router.get("", response_model=list[FamilyOut])
def list_families(
    q: str | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[FamilyOut]:
    return FamilyService(db).list_families(current_user.tenant_id, q)


@router.get("/next-number")
def get_next_family_number(
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> dict:
    return {"next_family_number": FamilyRepository(db).next_family_number(current_user.tenant_id)}


@router.get("/{family_id}", response_model=FamilyOut)
def get_family(
    family_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> FamilyOut:
    return FamilyService(db).get_family(current_user.tenant_id, family_id)


@router.patch("/{family_id}", response_model=FamilyOut)
def update_family(
    family_id: uuid.UUID,
    payload: FamilyUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> FamilyOut:
    return FamilyService(db).update_family(current_user.tenant_id, family_id, payload)


@router.get("/{family_id}/students", response_model=list[StudentOut])
def list_family_students(
    family_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[StudentOut]:
    return StudentService(db).list_students(current_user.tenant_id, family_id=family_id, status="all")
