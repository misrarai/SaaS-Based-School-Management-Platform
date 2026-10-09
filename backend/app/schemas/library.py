import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

MemberType = Literal["student", "teacher", "staff"]


# ---------- Settings ----------
class LibrarySettingsOut(BaseModel):
    student_loan_days: int
    teacher_loan_days: int
    staff_loan_days: int
    student_max_books: int
    teacher_max_books: int
    staff_max_books: int
    fine_per_day: float
    max_renewals: int
    reservation_hold_days: int

    model_config = {"from_attributes": True}


class LibrarySettingsUpdate(BaseModel):
    student_loan_days: int | None = Field(default=None, ge=1, le=365)
    teacher_loan_days: int | None = Field(default=None, ge=1, le=365)
    staff_loan_days: int | None = Field(default=None, ge=1, le=365)
    student_max_books: int | None = Field(default=None, ge=0, le=100)
    teacher_max_books: int | None = Field(default=None, ge=0, le=100)
    staff_max_books: int | None = Field(default=None, ge=0, le=100)
    fine_per_day: float | None = Field(default=None, ge=0)
    max_renewals: int | None = Field(default=None, ge=0, le=20)
    reservation_hold_days: int | None = Field(default=None, ge=1, le=60)


# ---------- Categories ----------
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    book_count: int = 0


# ---------- Books & copies ----------
class BookBase(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    isbn: str | None = Field(default=None, max_length=20)
    author: str | None = Field(default=None, max_length=255)
    publisher: str | None = Field(default=None, max_length=255)
    edition: str | None = Field(default=None, max_length=50)
    category_id: uuid.UUID | None = None
    subject: str | None = Field(default=None, max_length=100)
    rack_location: str | None = Field(default=None, max_length=50)
    price: float | None = Field(default=None, ge=0)
    purchase_date: date | None = None
    language: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=1000)


class BookCreate(BookBase):
    title: str = Field(min_length=1, max_length=255)
    copies: int = Field(default=0, ge=0, le=500, description="Number of copies to auto-create")


class BookUpdate(BookBase):
    pass


class BookOut(BaseModel):
    id: uuid.UUID
    title: str
    isbn: str | None
    author: str | None
    publisher: str | None
    edition: str | None
    category_id: uuid.UUID | None
    category_name: str | None
    subject: str | None
    rack_location: str | None
    price: float | None
    purchase_date: date | None
    language: str | None
    description: str | None
    total_copies: int
    available_copies: int
    issued_copies: int
    reserved_copies: int
    lost_copies: int
    damaged_copies: int


class CopyCreate(BaseModel):
    accession_number: str | None = Field(default=None, max_length=50)
    barcode: str | None = Field(default=None, max_length=100)
    quantity: int = Field(default=1, ge=1, le=500)
    notes: str | None = Field(default=None, max_length=255)


class CopyUpdate(BaseModel):
    accession_number: str | None = Field(default=None, min_length=1, max_length=50)
    barcode: str | None = Field(default=None, max_length=100)
    status: Literal["available", "lost", "damaged"] | None = None
    notes: str | None = Field(default=None, max_length=255)


class CopyOut(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    accession_number: str
    barcode: str | None
    status: str
    notes: str | None

    model_config = {"from_attributes": True}


class BookDetailOut(BookOut):
    copies: list[CopyOut]


# ---------- Members ----------
class MemberCreate(BaseModel):
    member_type: MemberType
    student_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None
    staff_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_reference(self):
        ref = {"student": self.student_id, "teacher": self.teacher_id, "staff": self.staff_id}[self.member_type]
        if ref is None:
            raise ValueError(f"{self.member_type}_id is required for member_type '{self.member_type}'")
        return self


class MemberStatusUpdate(BaseModel):
    status: Literal["active", "inactive"]


class MemberOut(BaseModel):
    id: uuid.UUID
    member_type: str
    student_id: uuid.UUID | None
    teacher_id: uuid.UUID | None
    staff_id: uuid.UUID | None
    card_number: str
    status: str
    joined_on: date
    full_name: str
    reference: str | None
    active_issues: int = 0
    outstanding_fine: float = 0


# ---------- Circulation ----------
class IssueCreate(BaseModel):
    member_id: uuid.UUID
    copy_id: uuid.UUID | None = None
    copy_identifier: str | None = Field(default=None, description="Accession number or barcode")
    issued_on: date | None = None
    due_date: date | None = None
    remarks: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _check_copy(self):
        if self.copy_id is None and not self.copy_identifier:
            raise ValueError("Either copy_id or copy_identifier is required")
        return self


class ReturnRequest(BaseModel):
    condition: Literal["good", "damaged", "lost"] = "good"
    returned_on: date | None = None
    extra_fine: float = Field(default=0, ge=0, description="Additional damage/loss charge")
    remarks: str | None = Field(default=None, max_length=255)


class ReturnByCopyRequest(ReturnRequest):
    copy_identifier: str = Field(min_length=1)


class RenewRequest(BaseModel):
    due_date: date | None = None


class FineAction(BaseModel):
    action: Literal["paid", "waived"]
    paid_on: date | None = None


class IssueOut(BaseModel):
    id: uuid.UUID
    copy_id: uuid.UUID
    accession_number: str | None
    book_id: uuid.UUID
    book_title: str | None
    book_author: str | None
    member_id: uuid.UUID
    member_name: str | None
    member_type: str | None
    card_number: str | None
    issued_on: date
    due_date: date
    returned_on: date | None
    return_condition: str | None
    renewals_count: int
    status: str
    is_overdue: bool
    days_overdue: int
    fine_amount: float
    fine_status: str
    fine_paid_on: date | None
    remarks: str | None


# ---------- Reservations ----------
class ReservationCreate(BaseModel):
    book_id: uuid.UUID
    member_id: uuid.UUID


class MyReservationCreate(BaseModel):
    book_id: uuid.UUID


class ReservationOut(BaseModel):
    id: uuid.UUID
    book_id: uuid.UUID
    book_title: str | None
    member_id: uuid.UUID
    member_name: str | None
    card_number: str | None
    reserved_at: datetime
    status: str
    copy_id: uuid.UUID | None
    accession_number: str | None
    ready_on: date | None
    expires_on: date | None
    queue_position: int | None = None


# ---------- Portal ----------
class MyLibraryOut(BaseModel):
    member: MemberOut | None
    issues: list[IssueOut]
    reservations: list[ReservationOut]
    outstanding_fine: float
    max_books: int
    loan_days: int


class ChildLibraryOut(MyLibraryOut):
    student_id: uuid.UUID
    student_name: str


# ---------- Reports ----------
class FineReportOut(BaseModel):
    total_collected: float
    total_waived: float
    total_outstanding: float
    items: list[IssueOut]


class MostIssuedOut(BaseModel):
    book_id: uuid.UUID
    title: str
    author: str | None
    issue_count: int


class LibrarySummaryOut(BaseModel):
    total_titles: int
    total_copies: int
    available_copies: int
    issued_copies: int
    reserved_copies: int
    lost_copies: int
    damaged_copies: int
    total_members: int
    overdue_count: int
    pending_reservations: int
    outstanding_fines: float
