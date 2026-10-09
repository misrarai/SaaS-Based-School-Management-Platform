import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.fee import InvoiceStatus, InvoiceType, PaymentMethod
from app.models.fee_collection import ConcessionType, FeeFrequency

# ---------------------------------------------------------------- fee heads / structure


class FeeHeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str | None = Field(default=None, max_length=20)
    default_frequency: FeeFrequency = FeeFrequency.MONTHLY
    description: str | None = Field(default=None, max_length=255)


class FeeHeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, max_length=20)
    default_frequency: FeeFrequency | None = None
    description: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class FeeHeadOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str | None
    default_frequency: FeeFrequency
    description: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class FeeStructureItemIn(BaseModel):
    fee_head_id: uuid.UUID
    amount: float = Field(ge=0)
    frequency: FeeFrequency


class FeeStructureSet(BaseModel):
    items: list[FeeStructureItemIn]


class FeeStructureItemOut(BaseModel):
    id: uuid.UUID
    class_grade_id: uuid.UUID
    fee_head_id: uuid.UUID
    fee_head_name: str
    amount: float
    frequency: FeeFrequency


class FeeStructureOut(BaseModel):
    class_grade_id: uuid.UUID
    class_grade_name: str
    items: list[FeeStructureItemOut]
    monthly_total: float


# ---------------------------------------------------------------- invoices with lines


class GenerateStructuredInvoicesRequest(BaseModel):
    """Generates one voucher per active student of the class for the period: every MONTHLY
    head of the class structure, plus any non-monthly heads listed in include_head_ids."""

    class_grade_id: uuid.UUID
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    due_date: date
    include_head_ids: list[uuid.UUID] = Field(default_factory=list)


class InvoiceLineIn(BaseModel):
    fee_head_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=255)
    amount: float = Field(gt=0)


class ItemizedInvoiceCreate(BaseModel):
    student_id: uuid.UUID
    invoice_type: InvoiceType = InvoiceType.OTHER
    due_date: date
    period_month: int | None = Field(default=None, ge=1, le=12)
    period_year: int | None = Field(default=None, ge=2000, le=2100)
    notes: str | None = Field(default=None, max_length=255)
    lines: list[InvoiceLineIn] = Field(min_length=1)


class InvoiceLineOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    fee_head_id: uuid.UUID | None
    description: str
    amount: float
    concession_amount: float

    model_config = {"from_attributes": True}


class InvoiceSummaryOut(BaseModel):
    id: uuid.UUID
    invoice_number: str
    student_id: uuid.UUID
    student_name: str
    admission_number: str | None
    class_grade_id: uuid.UUID
    class_grade_name: str
    invoice_type: InvoiceType
    period_month: int | None
    period_year: int | None
    due_date: date
    status: InvoiceStatus
    amount_due: float
    discount_amount: float
    late_fee_amount: float
    net_amount: float
    amount_paid: float
    balance: float


class GenerateStructuredInvoicesResult(BaseModel):
    invoices_created: int
    skipped_existing: int
    invoices: list[InvoiceSummaryOut]


# ---------------------------------------------------------------- concessions / late fee


class ConcessionCreate(BaseModel):
    student_id: uuid.UUID
    fee_head_id: uuid.UUID | None = None
    concession_type: ConcessionType
    value: float = Field(gt=0)
    reason: str | None = Field(default=None, max_length=255)
    valid_from: date | None = None
    valid_to: date | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.concession_type == ConcessionType.PERCENTAGE and self.value > 100:
            raise ValueError("Percentage concession cannot exceed 100")
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("valid_to must be on or after valid_from")
        return self


class ConcessionUpdate(BaseModel):
    concession_type: ConcessionType | None = None
    value: float | None = Field(default=None, gt=0)
    reason: str | None = Field(default=None, max_length=255)
    valid_from: date | None = None
    valid_to: date | None = None
    is_active: bool | None = None


class ConcessionOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    fee_head_id: uuid.UUID | None
    fee_head_name: str | None
    concession_type: ConcessionType
    value: float
    reason: str | None
    valid_from: date | None
    valid_to: date | None
    is_active: bool


class LateFeeRuleIn(BaseModel):
    amount: float = Field(ge=0)
    grace_days: int = Field(default=0, ge=0, le=365)
    is_active: bool = True


class LateFeeRuleOut(BaseModel):
    amount: float
    grace_days: int
    is_active: bool


# ---------------------------------------------------------------- counter


class CounterStudentOut(BaseModel):
    student_id: uuid.UUID
    student_name: str
    admission_number: str | None
    class_grade_name: str | None
    family_id: uuid.UUID | None


class CounterSearchResult(BaseModel):
    """One collectible account: a family (all its children) or a single student with no family."""

    family_id: uuid.UUID | None
    family_number: str | None
    family_name: str | None
    students: list[CounterStudentOut]
    outstanding: float


class CounterAccountOut(BaseModel):
    family_id: uuid.UUID | None
    family_number: str | None
    family_name: str | None
    students: list[CounterStudentOut]
    open_invoices: list[InvoiceSummaryOut]
    total_outstanding: float
    pending_late_fee: float


class CollectRequest(BaseModel):
    family_id: uuid.UUID | None = None
    student_id: uuid.UUID | None = None
    amount: float = Field(gt=0)
    payment_method: PaymentMethod = PaymentMethod.CASH
    collected_on: date | None = None
    reference_note: str | None = Field(default=None, max_length=255)
    invoice_ids: list[uuid.UUID] | None = None

    @model_validator(mode="after")
    def _check(self):
        if (self.family_id is None) == (self.student_id is None):
            raise ValueError("Provide exactly one of family_id or student_id")
        return self


class ReceiptAllocationOut(BaseModel):
    payment_id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str
    student_name: str
    amount: float
    invoice_balance_after: float
    invoice_status: InvoiceStatus


class ReceiptOut(BaseModel):
    id: uuid.UUID
    receipt_number: str
    family_id: uuid.UUID | None
    family_name: str | None
    student_id: uuid.UUID | None
    payer_name: str
    total_amount: float
    payment_method: PaymentMethod
    collected_on: date
    collected_by_name: str
    reference_note: str | None
    created_at: datetime
    allocations: list[ReceiptAllocationOut]


# ---------------------------------------------------------------- defaulters / ledger / reports


class DefaulterRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    admission_number: str | None
    class_grade_id: uuid.UUID | None
    class_grade_name: str | None
    family_id: uuid.UUID | None
    family_number: str | None
    family_name: str | None
    overdue_invoices: int
    oldest_due_date: date
    months_overdue: int
    overdue_balance: float


class ReminderRequest(BaseModel):
    student_ids: list[uuid.UUID] | None = None
    class_grade_id: uuid.UUID | None = None
    min_amount: float | None = None
    months_overdue: int | None = None


class ReminderResult(BaseModel):
    students_reminded: int
    notifications_logged: int


class LedgerEntry(BaseModel):
    entry_date: date
    kind: str  # "invoice" | "payment"
    reference: str
    description: str
    student_name: str
    debit: float
    credit: float
    balance: float


class LedgerOut(BaseModel):
    family_id: uuid.UUID | None
    family_number: str | None
    family_name: str | None
    students: list[CounterStudentOut]
    entries: list[LedgerEntry]
    total_billed: float
    total_paid: float
    closing_balance: float


class CollectionPaymentRow(BaseModel):
    payment_id: uuid.UUID
    collected_on: date
    receipt_number: str | None
    invoice_number: str
    student_name: str
    class_grade_name: str | None
    payment_method: PaymentMethod
    collector_name: str | None
    amount: float


class DailyCollectionDay(BaseModel):
    day: date
    total: float
    count: int


class DailyCollectionReport(BaseModel):
    date_from: date
    date_to: date
    total: float
    by_day: list[DailyCollectionDay]
    by_method: dict[str, float]
    by_collector: dict[str, float]
    payments: list[CollectionPaymentRow]


class ClassCollectionRow(BaseModel):
    class_grade_id: uuid.UUID
    class_grade_name: str
    students: int
    invoices: int
    billed: float
    collected: float
    outstanding: float


class ClassCollectionSummary(BaseModel):
    period_month: int | None
    period_year: int | None
    rows: list[ClassCollectionRow]
    total_billed: float
    total_collected: float
    total_outstanding: float
