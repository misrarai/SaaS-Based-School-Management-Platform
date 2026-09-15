import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.fee import InvoiceStatus, InvoiceType, PaymentMethod, PaymentVerificationStatus
from app.models.payment_gateway import GatewayTransactionStatus, PaymentGateway


class FeePlanCreate(BaseModel):
    class_grade_id: uuid.UUID
    academic_year: str = Field(min_length=4, max_length=20)
    monthly_amount: float = Field(gt=0)
    name: str | None = None


class FeePlanUpdate(BaseModel):
    monthly_amount: float | None = Field(default=None, gt=0)
    name: str | None = None


class FeePlanOut(BaseModel):
    id: uuid.UUID
    class_grade_id: uuid.UUID
    academic_year: str
    monthly_amount: float
    name: str | None

    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    student_id: uuid.UUID
    invoice_type: InvoiceType
    amount_due: float = Field(gt=0)
    due_date: date
    notes: str | None = None


class GenerateInvoicesRequest(BaseModel):
    class_grade_id: uuid.UUID
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    due_date: date


class BulkGenerateInvoicesRequest(BaseModel):
    """class_grade_ids omitted/empty means "every class that currently has a fee plan"."""

    class_grade_ids: list[uuid.UUID] = Field(default_factory=list)
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)
    due_date: date


class BulkGenerateInvoicesResult(BaseModel):
    invoices_created: int
    classes_processed: int
    skipped: list[str]


class InvoiceOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    class_grade_id: uuid.UUID
    invoice_type: InvoiceType
    invoice_number: str
    period_month: int | None
    period_year: int | None
    amount_due: float
    discount_amount: float
    net_amount: float
    due_date: date
    status: InvoiceStatus
    notes: str | None

    model_config = {"from_attributes": True}


class PaymentOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: float
    payment_method: PaymentMethod
    reference_note: str | None
    receipt_image_url: str | None
    submitted_by_user_id: uuid.UUID
    submitted_at: datetime
    verification_status: PaymentVerificationStatus
    verified_by_user_id: uuid.UUID | None
    verified_at: datetime | None
    rejection_reason: str | None

    model_config = {"from_attributes": True}


class PaymentVerifyRequest(BaseModel):
    approve: bool
    rejection_reason: str | None = None


class PaymentDetailOut(PaymentOut):
    """PaymentOut plus who it's for — resolved server-side so the admin list/verification
    screens can show "Student: Ahmed" without a client-side join."""

    student_id: uuid.UUID
    student_name: str
    invoice_number: str
    invoice_type: InvoiceType


class SubscriptionEntry(BaseModel):
    """One row per active student — their class's fee plan and where their most recent
    invoice stands, without the admin having to cross-reference two separate screens."""

    student_id: uuid.UUID
    student_name: str
    class_grade_id: uuid.UUID
    class_grade_name: str
    monthly_amount: float | None
    current_status: InvoiceStatus | None
    current_invoice_id: uuid.UUID | None


class InitiateGatewayPaymentResponse(BaseModel):
    """Everything the frontend needs to auto-submit an HTML form (POST) to the gateway's hosted
    checkout page — fields includes the secure hash already computed server-side."""

    checkout_url: str
    fields: dict[str, str]
    txn_ref_no: str


class GatewayTransactionOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    gateway: PaymentGateway
    txn_ref_no: str
    amount: float
    status: GatewayTransactionStatus
    gateway_response_code: str | None
    gateway_response_message: str | None
    gateway_txn_id: str | None
    payment_id: uuid.UUID | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class FeeReportSummary(BaseModel):
    period_month: int
    period_year: int
    total_collected: float
    total_pending: float
    total_overdue: float
    by_method: dict[str, float]
