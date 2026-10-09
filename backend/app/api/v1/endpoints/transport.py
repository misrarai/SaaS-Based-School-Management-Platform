import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.transport import (
    AllocationCreate,
    AllocationEnd,
    AllocationOut,
    AllocationUpdate,
    DriverCreate,
    DriverOut,
    DriverUpdate,
    ExpiringDocumentRow,
    MyTransportOut,
    RouteCreate,
    RouteOut,
    RouteStrengthRow,
    RouteUpdate,
    StopCreate,
    StopOut,
    StopUpdate,
    TransportFeeGenerate,
    TransportFeeGenerateResult,
    TransportFeeRecordOut,
    VehicleCreate,
    VehicleOut,
    VehicleUpdate,
)
from app.services.transport_service import TransportService

router = APIRouter(prefix="/transport", tags=["transport"])

admin_only = require_role(RoleEnum.ADMIN)


# ---------------------------------------------------------------- drivers
@router.post("/drivers", response_model=DriverOut, status_code=status.HTTP_201_CREATED)
def create_driver(payload: DriverCreate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).create_driver(user.tenant_id, payload)


@router.get("/drivers", response_model=list[DriverOut])
def list_drivers(user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).list_drivers(user.tenant_id)


@router.get("/drivers/{driver_id}", response_model=DriverOut)
def get_driver(driver_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).get_driver(user.tenant_id, driver_id)


@router.patch("/drivers/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: uuid.UUID, payload: DriverUpdate, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return TransportService(db).update_driver(user.tenant_id, driver_id, payload)


@router.delete("/drivers/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver(driver_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    TransportService(db).delete_driver(user.tenant_id, driver_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- vehicles
@router.post("/vehicles", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehicleCreate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).create_vehicle(user.tenant_id, payload)


@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).list_vehicles(user.tenant_id)


@router.get("/vehicles/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).get_vehicle(user.tenant_id, vehicle_id)


@router.patch("/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: uuid.UUID, payload: VehicleUpdate, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return TransportService(db).update_vehicle(user.tenant_id, vehicle_id, payload)


@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    TransportService(db).delete_vehicle(user.tenant_id, vehicle_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- routes & stops
@router.post("/routes", response_model=RouteOut, status_code=status.HTTP_201_CREATED)
def create_route(payload: RouteCreate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).create_route(user.tenant_id, payload)


@router.get("/routes", response_model=list[RouteOut])
def list_routes(user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).list_routes(user.tenant_id)


@router.get("/routes/{route_id}", response_model=RouteOut)
def get_route(route_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).get_route(user.tenant_id, route_id)


@router.patch("/routes/{route_id}", response_model=RouteOut)
def update_route(
    route_id: uuid.UUID, payload: RouteUpdate, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return TransportService(db).update_route(user.tenant_id, route_id, payload)


@router.delete("/routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(route_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    TransportService(db).delete_route(user.tenant_id, route_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/routes/{route_id}/stops", response_model=StopOut, status_code=status.HTTP_201_CREATED)
def add_stop(route_id: uuid.UUID, payload: StopCreate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).add_stop(user.tenant_id, route_id, payload)


@router.patch("/stops/{stop_id}", response_model=StopOut)
def update_stop(stop_id: uuid.UUID, payload: StopUpdate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).update_stop(user.tenant_id, stop_id, payload)


@router.delete("/stops/{stop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stop(stop_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    TransportService(db).delete_stop(user.tenant_id, stop_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- allocations
@router.post("/allocations", response_model=AllocationOut, status_code=status.HTTP_201_CREATED)
def create_allocation(payload: AllocationCreate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).create_allocation(user.tenant_id, payload)


@router.get("/allocations", response_model=list[AllocationOut])
def list_allocations(
    route_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default="active", alias="status"),
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return TransportService(db).list_allocations(user.tenant_id, route_id, status_filter)


@router.patch("/allocations/{allocation_id}", response_model=AllocationOut)
def update_allocation(
    allocation_id: uuid.UUID,
    payload: AllocationUpdate,
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return TransportService(db).update_allocation(user.tenant_id, allocation_id, payload)


@router.post("/allocations/{allocation_id}/end", response_model=AllocationOut)
def end_allocation(
    allocation_id: uuid.UUID,
    payload: AllocationEnd | None = None,
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return TransportService(db).end_allocation(user.tenant_id, allocation_id, payload.end_date if payload else None)


# ---------------------------------------------------------------- fees
@router.post("/fees/generate", response_model=TransportFeeGenerateResult)
def generate_fees(payload: TransportFeeGenerate, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).generate_fees(user.tenant_id, payload)


@router.get("/fees", response_model=list[TransportFeeRecordOut])
def list_fee_records(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None),
    user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return TransportService(db).list_fee_records(user.tenant_id, month, year)


# ---------------------------------------------------------------- reports
@router.get("/reports/route-strength", response_model=list[RouteStrengthRow])
def route_strength(user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return TransportService(db).route_strength(user.tenant_id)


@router.get("/reports/expiring-documents", response_model=list[ExpiringDocumentRow])
def expiring_documents(
    days: int = Query(default=30, ge=1, le=365), user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return TransportService(db).expiring_documents(user.tenant_id, days)


# ---------------------------------------------------------------- portal (student / parent)
@router.get("/me", response_model=list[MyTransportOut])
def my_transport(
    user: User = Depends(require_role(RoleEnum.STUDENT, RoleEnum.PARENT)), db: Session = Depends(get_db)
):
    return TransportService(db).my_transport(user)


@router.get("/students/{student_id}", response_model=MyTransportOut)
def student_transport(
    student_id: uuid.UUID,
    user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
):
    return TransportService(db).student_transport(user, student_id)
