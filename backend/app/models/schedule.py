import enum
import uuid
from datetime import date as date_
from datetime import datetime
from datetime import time as time_

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class SessionStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MeetingStatus(str, enum.Enum):
    """Google Meet generation outcome for a session — independent of SessionStatus (a session can
    be a perfectly valid SCHEDULED class whose Meet creation FAILED, e.g. because the tenant
    hasn't connected Google Calendar yet; the class still happens, just without an auto-generated
    link, and meeting_url can still be filled in manually)."""

    NOT_CREATED = "not_created"
    CREATED = "created"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ClassSchedule(UUIDPKMixin, TimestampMixin, Base):
    """Recurring weekly slot (section+subject+teacher). day_of_week follows Python's
    date.weekday() convention: Monday=0 .. Sunday=6."""

    __tablename__ = "class_schedules"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    section_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=False, index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time_] = mapped_column(Time, nullable=False)
    end_time: Mapped[time_] = mapped_column(Time, nullable=False)
    default_meeting_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class ClassSession(UUIDPKMixin, TimestampMixin, Base):
    """A dated instance of a class. class_schedule_id is null for one-off sessions."""

    __tablename__ = "class_sessions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "class_schedule_id", "session_date", name="uq_session_schedule_date"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    class_schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("class_schedules.id"), nullable=True, index=True
    )
    section_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=False, index=True
    )
    session_date: Mapped[date_] = mapped_column(Date, nullable=False)
    start_time: Mapped[time_] = mapped_column(Time, nullable=False)
    end_time: Mapped[time_] = mapped_column(Time, nullable=False)
    # Title/description are only meaningful for an ad-hoc "online class" created directly (see
    # ScheduleService.create_online_class) — a session generated from a recurring ClassSchedule
    # template has neither, since the template itself carries no such fields.
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    # Generic join-link shown across every existing Join-class UI (teacher/student/parent) — kept
    # exactly as it was so none of that UI needs to change. When Google Meet creation succeeds
    # this is set to the same value as meet_link; it can also still be set manually (Zoom, etc.)
    # for a tenant that hasn't connected Google Calendar.
    meeting_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus), default=SessionStatus.SCHEDULED, nullable=False)
    actual_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # --- Google Calendar / Meet integration — see app/services/google_calendar_service.py ---
    google_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meet_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    google_calendar_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meeting_status: Mapped[MeetingStatus] = mapped_column(
        Enum(MeetingStatus), default=MeetingStatus.NOT_CREATED, nullable=False
    )
