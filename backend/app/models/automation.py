"""Automation / Auto-Notifications: admin-defined rules that fire a message through a channel
when a domain event happens (student absent, payment verified, result published, fee due).
Tenant-scoped like everything else."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin, utcnow

# events a rule can subscribe to
AUTOMATION_EVENTS = ("student_absent", "payment_verified", "result_published", "fee_due_reminder")
AUTOMATION_CHANNELS = ("sms", "email", "whatsapp")


class AutomationRule(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "automation_rules"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    event: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)  # email subject
    message_template: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class AutomationRun(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "automation_runs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    rule_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("automation_rules.id"), nullable=False, index=True)
    event: Mapped[str] = mapped_column(String(40), nullable=False)
    recipients: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    fired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
