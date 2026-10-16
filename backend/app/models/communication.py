"""Communication module: notice board, daily diary, in-app message threads, events calendar,
personal to-do lists and a log of bulk SMS (or fallback) sends. All tables tenant-scoped."""

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin

NOTICE_AUDIENCES = ("all", "staff", "students", "parents", "classes")
EVENT_AUDIENCES = ("all", "staff", "students", "parents")
EVENT_TYPES = ("holiday", "event", "exam", "meeting")


class Notice(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "notices"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    audience: Mapped[str] = mapped_column(String(20), default="all", nullable=False)
    # Only used when audience == "classes": list of ClassGrade id strings.
    class_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    publish_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class DiaryEntry(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "diary_entries"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False, index=True)
    # Null section = the entry applies to every section of the class.
    section_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=True)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=True)
    diary_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    homework: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    posted_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)


class MessageThread(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "message_threads"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class ThreadParticipant(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "thread_participants"
    __table_args__ = (UniqueConstraint("thread_id", "user_id", name="uq_thread_participant"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    thread_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("message_threads.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DirectMessage(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "direct_messages"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    thread_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("message_threads.id"), nullable=False, index=True)
    sender_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)


class SchoolEvent(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "school_events"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_type: Mapped[str] = mapped_column(String(20), default="event", nullable=False)
    audience: Mapped[str] = mapped_column(String(20), default="all", nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class TodoItem(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "todo_items"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class CommunicationLog(UUIDPKMixin, TimestampMixin, Base):
    """One row per recipient per channel attempt of a bulk SMS send (sms, or email fallback)."""

    __tablename__ = "communication_logs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)  # sms | email
    audience: Mapped[str] = mapped_column(String(100), nullable=False)
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    recipient_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # sent | failed | skipped
    detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sent_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
