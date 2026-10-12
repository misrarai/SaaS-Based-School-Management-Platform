import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.holiday import Holiday
from app.models.user import RoleEnum, User
from app.schemas.holiday import HolidayCreate, HolidayOut, HolidayUpdate

router = APIRouter(prefix="/holidays", tags=["holidays"])
# calendar is visible to everyone; mutations are admin-only
any_role = require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)
admin_only = require_role(RoleEnum.ADMIN)


def _out(h: Holiday) -> dict:
    return {
        "id": h.id, "name": h.name, "from_date": h.from_date, "to_date": h.to_date,
        "holiday_type": h.holiday_type, "description": h.description, "is_recurring": h.is_recurring,
        "days": (h.to_date - h.from_date).days + 1,
    }


@router.get("", response_model=list[HolidayOut])
def list_holidays(year: int | None = Query(default=None), current_user: User = Depends(any_role), db: Session = Depends(get_db)):
    stmt = select(Holiday).where(Holiday.tenant_id == current_user.tenant_id)
    if year:
        stmt = stmt.where(Holiday.from_date >= date(year, 1, 1), Holiday.from_date <= date(year, 12, 31))
    stmt = stmt.order_by(Holiday.from_date)
    return [_out(h) for h in db.execute(stmt).scalars().all()]


@router.post("", response_model=HolidayOut, status_code=status.HTTP_201_CREATED)
def create_holiday(payload: HolidayCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    h = Holiday(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    return _out(h)


@router.patch("/{holiday_id}", response_model=HolidayOut)
def update_holiday(holiday_id: uuid.UUID, payload: HolidayUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    h = db.get(Holiday, holiday_id)
    if h is None or h.tenant_id != current_user.tenant_id:
        raise NotFoundError("Holiday not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(h, field, value)
    db.commit()
    db.refresh(h)
    return _out(h)


@router.delete("/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday(holiday_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    h = db.get(Holiday, holiday_id)
    if h is None or h.tenant_id != current_user.tenant_id:
        raise NotFoundError("Holiday not found")
    db.delete(h)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
