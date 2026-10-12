import uuid
from datetime import datetime

from pydantic import BaseModel, Field

EVENT_PATTERN = r"^(student_absent|payment_verified|result_published|fee_due_reminder)$"
CHANNEL_PATTERN = r"^(sms|email|whatsapp)$"


class AutomationRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    event: str = Field(pattern=EVENT_PATTERN)
    channel: str = Field(pattern=CHANNEL_PATTERN)
    subject: str | None = Field(default=None, max_length=255)
    message_template: str = Field(min_length=1)
    is_active: bool = True


class AutomationRuleUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    event: str | None = Field(default=None, pattern=EVENT_PATTERN)
    channel: str | None = Field(default=None, pattern=CHANNEL_PATTERN)
    subject: str | None = None
    message_template: str | None = None
    is_active: bool | None = None


class AutomationRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    event: str
    channel: str
    subject: str | None
    message_template: str
    is_active: bool

    model_config = {"from_attributes": True}


class AutomationRunOut(BaseModel):
    id: uuid.UUID
    rule_id: uuid.UUID
    event: str
    recipients: int
    sent: int
    failed: int
    skipped: int
    detail: str | None
    fired_at: datetime

    model_config = {"from_attributes": True}


class AutomationTestResult(BaseModel):
    recipients: int
    sent: int
    failed: int
    skipped: int
    detail: str | None
    preview: str
