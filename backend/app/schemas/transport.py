import uuid
from datetime import date

from pydantic import BaseModel, Field

TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


# ---------- Drivers ----------
class DriverCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    cnic: str | None = None
    license_number: str | None = None
    license_expiry: date | None = None
    address: str | None = None
    salary: float | None = Field(default=None, ge=0)
    staff_id: uuid.UUID | None = None


class DriverUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = None
    cnic: str | None = None
    license_number: str | None = None
    license_expiry: date | None = None
    address: str | None = None
    salary: float | None = Field(default=None, ge=0)
    staff_id: uuid.UUID | None = None
    status: str | None = Field(default=None, pattern="^(active|inactive)$")


class DriverOut(BaseModel):
    id: uuid.UUID
    full_name: str
    phone: str | None
    cnic: str | None
    license_number: str | None
    license_expiry: date | None
    address: str | None
    salary: float | None
    staff_id: uuid.UUID | None
    status: str

    model_config = {"from_attributes": True}


# ---------- Vehicles ----------
class VehicleCreate(BaseModel):
    registration_number: str = Field(min_length=1, max_length=30)
    vehicle_type: str = Field(default="bus", pattern="^(bus|van|car)$")
    capacity: int = Field(ge=1, le=200)
    model: str | None = None
    insurance_expiry: date | None = None
    fitness_expiry: date | None = None
    driver_id: uuid.UUID | None = None
    conductor_name: str | None = None
    conductor_phone: str | None = None


class VehicleUpdate(BaseModel):
    registration_number: str | None = Field(default=None, min_length=1, max_length=30)
    vehicle_type: str | None = Field(default=None, pattern="^(bus|van|car)$")
    capacity: int | None = Field(default=None, ge=1, le=200)
    model: str | None = None
    insurance_expiry: date | None = None
    fitness_expiry: date | None = None
    driver_id: uuid.UUID | None = None
    conductor_name: str | None = None
    conductor_phone: str | None = None
    status: str | None = Field(default=None, pattern="^(active|inactive|maintenance)$")


class VehicleOut(BaseModel):
    id: uuid.UUID
    registration_number: str
    vehicle_type: str
    capacity: int
    model: str | None
    insurance_expiry: date | None
    fitness_expiry: date | None
    driver_id: uuid.UUID | None
    driver_name: str | None = None
    driver_phone: str | None = None
    conductor_name: str | None
    conductor_phone: str | None
    status: str
    allocated_count: int = 0


# ---------- Routes & Stops ----------
class StopCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    stop_order: int = Field(default=1, ge=0)
    pickup_time: str | None = Field(default=None, pattern=TIME_PATTERN)
    drop_time: str | None = Field(default=None, pattern=TIME_PATTERN)
    monthly_fare: float = Field(default=0, ge=0)


class StopUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    stop_order: int | None = Field(default=None, ge=0)
    pickup_time: str | None = Field(default=None, pattern=TIME_PATTERN)
    drop_time: str | None = Field(default=None, pattern=TIME_PATTERN)
    monthly_fare: float | None = Field(default=None, ge=0)


class StopOut(BaseModel):
    id: uuid.UUID
    route_id: uuid.UUID
    name: str
    stop_order: int
    pickup_time: str | None
    drop_time: str | None
    monthly_fare: float

    model_config = {"from_attributes": True}


class RouteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str | None = None
    vehicle_id: uuid.UUID | None = None
    start_point: str | None = None
    description: str | None = None
    stops: list[StopCreate] = []


class RouteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    code: str | None = None
    vehicle_id: uuid.UUID | None = None
    start_point: str | None = None
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(active|inactive)$")


class RouteOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str | None
    vehicle_id: uuid.UUID | None
    vehicle_registration: str | None = None
    vehicle_capacity: int | None = None
    start_point: str | None
    description: str | None
    status: str
    stops: list[StopOut] = []
    allocated_count: int = 0


# ---------- Allocations ----------
class AllocationCreate(BaseModel):
    student_id: uuid.UUID
    route_id: uuid.UUID
    stop_id: uuid.UUID
    pickup_type: str = Field(default="both", pattern="^(both|pickup|drop)$")
    start_date: date
    end_date: date | None = None
    notes: str | None = None


class AllocationUpdate(BaseModel):
    route_id: uuid.UUID | None = None
    stop_id: uuid.UUID | None = None
    pickup_type: str | None = Field(default=None, pattern="^(both|pickup|drop)$")
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


class AllocationEnd(BaseModel):
    end_date: date | None = None


class AllocationOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str | None = None
    route_id: uuid.UUID
    route_name: str | None = None
    stop_id: uuid.UUID
    stop_name: str | None = None
    pickup_type: str
    start_date: date
    end_date: date | None
    status: str
    monthly_fare: float = 0
    notes: str | None


# ---------- Fees ----------
class TransportFeeGenerate(BaseModel):
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    due_date: date


class TransportFeeRecordOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str | None = None
    allocation_id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str | None = None
    invoice_status: str | None = None
    period_month: int
    period_year: int
    amount: float


class TransportFeeGenerateResult(BaseModel):
    created_count: int
    skipped_count: int
    skipped: list[str]
    records: list[TransportFeeRecordOut]


# ---------- Reports ----------
class RouteStrengthRow(BaseModel):
    route_id: uuid.UUID
    route_name: str
    vehicle_registration: str | None
    capacity: int | None
    student_count: int
    students: list[AllocationOut]


class ExpiringDocumentRow(BaseModel):
    kind: str  # vehicle_insurance | vehicle_fitness | driver_license
    reference_id: uuid.UUID
    label: str
    expiry_date: date
    days_left: int


# ---------- Portal ----------
class MyTransportOut(BaseModel):
    student_id: uuid.UUID
    student_name: str | None
    allocation_id: uuid.UUID | None = None
    route_name: str | None = None
    route_code: str | None = None
    stop_name: str | None = None
    pickup_type: str | None = None
    pickup_time: str | None = None
    drop_time: str | None = None
    monthly_fare: float | None = None
    vehicle_registration: str | None = None
    vehicle_type: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    conductor_name: str | None = None
    conductor_phone: str | None = None
