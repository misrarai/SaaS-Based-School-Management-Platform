import uuid
from datetime import date

from pydantic import BaseModel, Field

STATUS_PATTERN = r"^(active|completed|left)$"
GRADE_PATTERN = r"^(excellent|good|fair|weak)$"


# ---------- Halqas ----------


class HalqaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    incharge: str | None = Field(default=None, max_length=150)
    description: str | None = None


class HalqaUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    incharge: str | None = None
    description: str | None = None
    is_active: bool | None = None


class HalqaOut(BaseModel):
    id: uuid.UUID
    name: str
    incharge: str | None
    description: str | None
    is_active: bool
    student_count: int = 0

    model_config = {"from_attributes": True}


# ---------- Enrolments ----------


class EnrolmentCreate(BaseModel):
    halqa_id: uuid.UUID
    student_id: uuid.UUID
    start_date: date | None = None
    current_juz: int = Field(default=1, ge=1, le=30)
    current_page: int = Field(default=1, ge=1)


class EnrolmentUpdate(BaseModel):
    halqa_id: uuid.UUID | None = None
    current_juz: int | None = Field(default=None, ge=1, le=30)
    current_page: int | None = Field(default=None, ge=1)
    status: str | None = Field(default=None, pattern=STATUS_PATTERN)
    notes: str | None = None


class EnrolmentOut(BaseModel):
    id: uuid.UUID
    halqa_id: uuid.UUID
    halqa_name: str | None
    student_id: uuid.UUID
    student_name: str | None
    admission_number: str | None
    start_date: date
    current_juz: int
    current_page: int
    status: str
    notes: str | None
    records_count: int = 0

    model_config = {"from_attributes": True}


# ---------- Daily records ----------


class DailyRecordCreate(BaseModel):
    record_date: date | None = None
    sabaq: str | None = Field(default=None, max_length=255)
    sabqi: str | None = Field(default=None, max_length=255)
    manzil: str | None = Field(default=None, max_length=255)
    grade: str | None = Field(default=None, pattern=GRADE_PATTERN)
    mistakes: int | None = Field(default=None, ge=0)
    remarks: str | None = None


class DailyRecordOut(BaseModel):
    id: uuid.UUID
    enrolment_id: uuid.UUID
    record_date: date
    sabaq: str | None
    sabqi: str | None
    manzil: str | None
    grade: str | None
    mistakes: int | None
    remarks: str | None

    model_config = {"from_attributes": True}


# ---------- Donors ----------


class DonorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=150)
    address: str | None = None


class DonorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    is_active: bool | None = None


class DonorOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    address: str | None
    is_active: bool
    total_donated: float = 0
    active_sponsorships: int = 0

    model_config = {"from_attributes": True}


# ---------- Donations ----------


class DonationCreate(BaseModel):
    donor_id: uuid.UUID
    amount: float = Field(gt=0)
    donation_date: date | None = None
    purpose: str | None = Field(default=None, max_length=255)
    payment_method: str | None = Field(default=None, max_length=30)
    notes: str | None = None


class DonationOut(BaseModel):
    id: uuid.UUID
    donor_id: uuid.UUID
    donor_name: str | None
    amount: float
    donation_date: date
    purpose: str | None
    payment_method: str | None
    notes: str | None

    model_config = {"from_attributes": True}


# ---------- Sponsorships ----------


class SponsorshipCreate(BaseModel):
    donor_id: uuid.UUID
    student_id: uuid.UUID
    monthly_amount: float = Field(gt=0)
    start_date: date | None = None
    notes: str | None = None


class SponsorshipUpdate(BaseModel):
    monthly_amount: float | None = Field(default=None, gt=0)
    status: str | None = Field(default=None, pattern=r"^(active|ended)$")
    notes: str | None = None


class SponsorshipOut(BaseModel):
    id: uuid.UUID
    donor_id: uuid.UUID
    donor_name: str | None
    student_id: uuid.UUID
    student_name: str | None
    monthly_amount: float
    start_date: date
    status: str
    notes: str | None

    model_config = {"from_attributes": True}
