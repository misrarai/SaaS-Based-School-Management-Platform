import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.hostel import (
    HostelAllocationCreate,
    HostelAllocationOut,
    HostelAllocationVacate,
    HostelCreate,
    HostelFeeGenerate,
    HostelFeeGenerateResult,
    HostelFeeRecordOut,
    HostelOut,
    HostelUpdate,
    MessMenuOut,
    MessMenuSave,
    MyHostelOut,
    OccupancyRow,
    OutpassCreate,
    OutpassDecision,
    OutpassOut,
    OutpassReturn,
    RoomCreate,
    RoomOut,
    RoomUpdate,
)
from app.services.hostel_service import HostelService

router = APIRouter(prefix="/hostel", tags=["hostel"])

admin_only = require_role(RoleEnum.ADMIN)
any_role = require_role(RoleEnum.ADMIN, RoleEnum.STUDENT, RoleEnum.PARENT)


# ---------------------------------------------------------------- hostels
@router.post("/hostels", response_model=HostelOut, status_code=status.HTTP_201_CREATED)
def create_hostel(payload: HostelCreate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HostelService(db).create_hostel(user.tenant_id, payload)


@router.get("/hostels", response_model=list[HostelOut])
def list_hostels(user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HostelService(db).list_hostels(user.tenant_id)


@router.get("/hostels/{hostel_id}", response_model=HostelOut)
def get_hostel(hostel_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HostelService(db).get_hostel(user.tenant_id, hostel_id)


@router.patch("/hostels/{hostel_id}", response_model=HostelOut)
def update_hostel(
    hostel_id: uuid.UUID, payload: HostelUpdate, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return HostelService(db).update_hostel(user.tenant_id, hostel_id, payload)


@router.delete("/hostels/{hostel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hostel(hostel_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    HostelService(db).delete_hostel(user.tenant_id, hostel_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- rooms
@router.post("/hostels/{hostel_id}/rooms", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(
    hostel_id: uuid.UUID, payload: RoomCreate, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return HostelService(db).create_room(user.tenant_id, hostel_id, payload)


@router.get("/rooms", response_model=list[RoomOut])
def list_rooms(
    hostel_id: uuid.UUID | None = Query(default=None), user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return HostelService(db).list_rooms(user.tenant_id, hostel_id)


@router.patch("/rooms/{room_id}", response_model=RoomOut)
def update_room(room_id: uuid.UUID, payload: RoomUpdate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HostelService(db).update_room(user.tenant_id, room_id, payload)


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    HostelService(db).delete_room(user.tenant_id, room_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- allocations
@router.post("/allocations", response_model=HostelAllocationOut, status_code=status.HTTP_201_CREATED)
def create_allocation(payload: HostelAllocationCreate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HostelService(db).create_allocation(user.tenant_id, payload)


@router.get("/allocations", response_model=list[HostelAllocationOut])
def list_allocations(
    hostel_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default="active", alias="status"),
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return HostelService(db).list_allocations(user.tenant_id, hostel_id, status_filter)


@router.post("/allocations/{allocation_id}/vacate", response_model=HostelAllocationOut)
def vacate_allocation(
    allocation_id: uuid.UUID,
    payload: HostelAllocationVacate | None = None,
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return HostelService(db).vacate(user.tenant_id, allocation_id, payload.to_date if payload else None)


# ---------------------------------------------------------------- fees
@router.post("/fees/generate", response_model=HostelFeeGenerateResult)
def generate_fees(payload: HostelFeeGenerate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HostelService(db).generate_fees(user.tenant_id, payload)


@router.get("/fees", response_model=list[HostelFeeRecordOut])
def list_fee_records(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None),
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return HostelService(db).list_fee_records(user.tenant_id, month, year)


# ---------------------------------------------------------------- mess menu
@router.get("/mess-menu", response_model=list[MessMenuOut])
def get_mess_menu(
    hostel_id: uuid.UUID | None = Query(default=None), user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return HostelService(db).get_mess_menu(user.tenant_id, hostel_id)


@router.put("/mess-menu", response_model=list[MessMenuOut])
def save_mess_menu(payload: MessMenuSave, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HostelService(db).save_mess_menu(user.tenant_id, payload)


# ---------------------------------------------------------------- outpasses
@router.post("/outpasses", response_model=OutpassOut, status_code=status.HTTP_201_CREATED)
def create_outpass(
    payload: OutpassCreate,
    user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
):
    return HostelService(db).create_outpass(user, payload)


@router.get("/outpasses", response_model=list[OutpassOut])
def list_outpasses(
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(any_role),
    db: Session = Depends(get_db),
):
    return HostelService(db).list_outpasses(user, status_filter)


@router.post("/outpasses/{outpass_id}/approve", response_model=OutpassOut)
def approve_outpass(
    outpass_id: uuid.UUID,
    payload: OutpassDecision | None = None,
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return HostelService(db).decide_outpass(user, outpass_id, True, payload.remarks if payload else None)


@router.post("/outpasses/{outpass_id}/reject", response_model=OutpassOut)
def reject_outpass(
    outpass_id: uuid.UUID,
    payload: OutpassDecision | None = None,
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return HostelService(db).decide_outpass(user, outpass_id, False, payload.remarks if payload else None)


@router.post("/outpasses/{outpass_id}/return", response_model=OutpassOut)
def mark_outpass_returned(
    outpass_id: uuid.UUID,
    payload: OutpassReturn | None = None,
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return HostelService(db).mark_returned(user.tenant_id, outpass_id, payload.actual_return_at if payload else None)


# ---------------------------------------------------------------- reports
@router.get("/reports/occupancy", response_model=list[OccupancyRow])
def occupancy(user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return HostelService(db).occupancy(user.tenant_id)


# ---------------------------------------------------------------- portal (student / parent)
@router.get("/me", response_model=list[MyHostelOut])
def my_hostel(user: User = Depends(require_role(RoleEnum.STUDENT, RoleEnum.PARENT)), db: Session = Depends(get_db)):
    return HostelService(db).my_hostel(user)


@router.get("/students/{student_id}", response_model=MyHostelOut)
def student_hostel(student_id: uuid.UUID, user: User = Depends(any_role), db: Session = Depends(get_db)):
    return HostelService(db).student_hostel(user, student_id)
