import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class NotificationChannel(str, enum.Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"


class NotificationEvent(str, enum.Enum):
    ATTENDANCE_ABSENT = "attendance_absent"
    PAYMENT_VERIFIED = "payment_verified"
    FEE_DUE_REMINDER = "fee_due_reminder"
    BROADCAST = "broadcast"
    REPORT_CARD = "report_card"
    CUSTOM_EMAIL = "custom_email"
    ADMIN_NOTIFICATION = "admin_notification"


class NotificationStatus(str, enum.Enum):
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


class NotificationLog(UUIDPKMixin, TimestampMixin, Base):
    """A record of every notification attempt, sent or not — this is what gives the admin
    visibility into whether WhatsApp is actually configured and whether messages are landing,
    since delivery can't be verified any other way from inside this app."""

    __tablename__ = "notification_logs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    channel: Mapped[NotificationChannel] = mapped_column(Enum(NotificationChannel), nullable=False)
    event: Mapped[NotificationEvent] = mapped_column(Enum(NotificationEvent), nullable=False)
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    recipient_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=True, index=True
    )
    status: Mapped[NotificationStatus] = mapped_column(Enum(NotificationStatus), nullable=False)
    # Provider-assigned id for a successful send (e.g. Meta's "wamid...") — lets the admin
    # correlate a log entry with delivery/read-status webhooks or support tickets later, without
    # this app needing to implement any inbound webhook itself.
    provider_message_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
