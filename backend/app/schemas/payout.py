import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.payout import PayoutRateType, PayoutStatus


class PayoutRateCreate(BaseModel):
    teacher_id: uuid.UUID
    subject_id: uuid.UUID | None = None
    rate_type: PayoutRateType
    rate_value: float = Field(gt=0)
    effective_from: date


class PayoutRateOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    subject_id: uuid.UUID | None
    rate_type: PayoutRateType
    rate_value: float
    effective_from: date
    is_active: bool

    model_config = {"from_attributes": True}


class GeneratePayoutRequest(BaseModel):
    teacher_id: uuid.UUID
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)


class BulkGeneratePayoutsRequest(BaseModel):
    period_month: int = Field(ge=1, le=12)
    period_year: int = Field(ge=2000, le=2100)


class PayoutOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    period_month: int
    period_year: int
    sessions_delivered: int
    calculated_amount: float
    status: PayoutStatus
    approved_by_user_id: uuid.UUID | None
    paid_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}
