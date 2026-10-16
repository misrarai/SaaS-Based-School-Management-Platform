import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------- Hostels ----------
class HostelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    hostel_type: str = Field(default="boys", pattern="^(boys|girls|mixed)$")
    warden_name: str | None = None
    warden_phone: str | None = None
    address: str | None = None


class HostelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    hostel_type: str | None = Field(default=None, pattern="^(boys|girls|mixed)$")
    warden_name: str | None = None
    warden_phone: str | None = None
    address: str | None = None
    status: str | None = Field(default=None, pattern="^(active|inactive)$")


class HostelOut(BaseModel):
    id: uuid.UUID
    name: str
    hostel_type: str
    warden_name: str | None
    warden_phone: str | None
    address: str | None
    status: str
    room_count: int = 0
    total_beds: int = 0
    occupied_beds: int = 0


# ---------- Rooms ----------
class RoomCreate(BaseModel):
    room_number: str = Field(min_length=1, max_length=30)
    floor: str | None = None
    room_type: str | None = None
    capacity: int = Field(ge=1, le=100)
    monthly_fee: float = Field(default=0, ge=0)


class RoomUpdate(BaseModel):
    room_number: str | None = Field(default=None, min_length=1, max_length=30)
    floor: str | None = None
    room_type: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=100)
    monthly_fee: float | None = Field(default=None, ge=0)
    status: str | None = Field(default=None, pattern="^(active|inactive|maintenance)$")


class RoomOut(BaseModel):
    id: uuid.UUID
    hostel_id: uuid.UUID
    hostel_name: str | None = None
    room_number: str
    floor: str | None
    room_type: str | None
    capacity: int
    monthly_fee: float
    status: str
    occupied: int = 0
    available: int = 0


# ---------- Allocations ----------
class HostelAllocationCreate(BaseModel):
    student_id: uuid.UUID
    room_id: uuid.UUID
    bed_label: str | None = Field(default=None, max_length=20)
    from_date: date
    to_date: date | None = None
    notes: str | None = None


class HostelAllocationVacate(BaseModel):
    to_date: date | None = None


class HostelAllocationOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str | None = None
    hostel_id: uuid.UUID
    hostel_name: str | None = None
    room_id: uuid.UUID
    room_number: str | None = None
    bed_label: str | None
    from_date: date
    to_date: date | None
    status: str
    monthly_fee: float = 0
    notes: str | None


# ---------- Fees ----------
class HostelFeeGenerate(BaseModel):
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    due_date: date


class HostelFeeRecordOut(BaseModel):
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


class HostelFeeGenerateResult(BaseModel):
    created_count: int
    skipped_count: int
    skipped: list[str]
    records: list[HostelFeeRecordOut]


# ---------- Mess menu ----------
class MessMenuEntry(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    breakfast: str | None = None
    lunch: str | None = None
    dinner: str | None = None


class MessMenuSave(BaseModel):
    hostel_id: uuid.UUID | None = None
    entries: list[MessMenuEntry]


class MessMenuOut(BaseModel):
    id: uuid.UUID
    hostel_id: uuid.UUID | None
    day_of_week: int
    breakfast: str | None
    lunch: str | None
    dinner: str | None

    model_config = {"from_attributes": True}


# ---------- Outpasses ----------
class OutpassCreate(BaseModel):
    student_id: uuid.UUID
    out_at: datetime
    expected_return_at: datetime
    reason: str = Field(min_length=2, max_length=500)
    visitor_name: str | None = None
    visitor_relation: str | None = None


class OutpassDecision(BaseModel):
    remarks: str | None = None


class OutpassReturn(BaseModel):
    actual_return_at: datetime | None = None


class OutpassOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str | None = None
    hostel_id: uuid.UUID | None
    hostel_name: str | None = None
    out_at: datetime
    expected_return_at: datetime
    actual_return_at: datetime | None
    reason: str
    visitor_name: str | None
    visitor_relation: str | None
    status: str
    approved_by_name: str | None
    remarks: str | None
    is_late: bool = False


# ---------- Reports ----------
class OccupancyRow(BaseModel):
    hostel_id: uuid.UUID
    hostel_name: str
    hostel_type: str
    room_count: int
    total_beds: int
    occupied_beds: int
    available_beds: int
    occupancy_percent: float
    rooms: list[RoomOut]


# ---------- Portal ----------
class MyHostelOut(BaseModel):
    student_id: uuid.UUID
    student_name: str | None
    allocation_id: uuid.UUID | None = None
    hostel_name: str | None = None
    hostel_type: str | None = None
    warden_name: str | None = None
    warden_phone: str | None = None
    room_number: str | None = None
    floor: str | None = None
    room_type: str | None = None
    bed_label: str | None = None
    from_date: date | None = None
    monthly_fee: float | None = None
    mess_menu: list[MessMenuOut] = []
    outpasses: list[OutpassOut] = []
