import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.staff import StaffCreate, StaffOut, StaffStatusUpdate, StaffUpdate
from app.services.staff_service import StaffService

router = APIRouter(prefix="/staff", tags=["staff"])


@router.post("", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StaffOut:
    return StaffService(db).create_staff(current_user.tenant_id, payload)


@router.get("", response_model=list[StaffOut])
def list_staff(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[StaffOut]:
    return StaffService(db).list_staff(current_user.tenant_id, q, status_filter)


@router.get("/{staff_id}", response_model=StaffOut)
def get_staff(
    staff_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StaffOut:
    return StaffService(db).get_staff(current_user.tenant_id, staff_id)


@router.patch("/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: uuid.UUID,
    payload: StaffUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StaffOut:
    return StaffService(db).update_staff(current_user.tenant_id, staff_id, payload)


@router.post("/{staff_id}/status", response_model=StaffOut)
def set_staff_status(
    staff_id: uuid.UUID,
    payload: StaffStatusUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StaffOut:
    return StaffService(db).set_status(current_user.tenant_id, staff_id, payload.status)
