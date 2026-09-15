import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.notification import NotificationChannel, NotificationEvent, NotificationStatus


class NotificationLogOut(BaseModel):
    id: uuid.UUID
    channel: NotificationChannel
    event: NotificationEvent
    recipient_user_id: uuid.UUID | None
    recipient_phone: str | None
    recipient_email: str | None
    provider_message_id: str | None
    student_id: uuid.UUID | None
    status: NotificationStatus
    detail: str | None
    sent_at: datetime

    model_config = {"from_attributes": True}


class SendDueRemindersRequest(BaseModel):
    days_ahead: int = Field(default=3, ge=0, le=30)


class SendDueRemindersResult(BaseModel):
    invoices_checked: int
    notifications_sent: int


class BroadcastRequest(BaseModel):
    """class_grade_ids omitted/empty means "every active student in the academy"."""

    class_grade_ids: list[uuid.UUID] = Field(default_factory=list)
    message: str = Field(min_length=1, max_length=1000)


class BroadcastResult(BaseModel):
    students_targeted: int
    notifications_sent: int


class SendCustomEmailRequest(BaseModel):
    """Ad-hoc email to any address — the recipient is not looked up from the database, so it
    works for reports/information sent to people who aren't a parent user in the system."""

    to_email: EmailStr
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


class SendNotificationRequest(BaseModel):
    """The admin's general "compose one message, pick exactly one channel" tool. channel is
    validated against NotificationChannel — anything outside {email, whatsapp} (e.g. "sms",
    "telegram") is rejected with a 422 automatically, since pydantic only accepts defined enum
    members."""

    student_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=2000)
    channel: NotificationChannel


class SendReportCardEmailRequest(BaseModel):
    period_month: int | None = Field(default=None, ge=1, le=12)
    period_year: int | None = Field(default=None, ge=2000, le=2100)
    to_email: EmailStr | None = Field(default=None, description="Overrides the default of every linked parent's email")
