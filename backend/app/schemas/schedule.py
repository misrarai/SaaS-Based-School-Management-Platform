import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, Field

from app.models.notification import NotificationChannel
from app.models.schedule import MeetingStatus, SessionStatus


class MeetingTokenOut(BaseModel):
    session_id: uuid.UUID
    room_name: str
    meeting_url: str
    jwt_token: str | None
    authenticated: bool


class ClassScheduleCreate(BaseModel):
    section_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    day_of_week: int = Field(ge=0, le=6, description="Monday=0 .. Sunday=6")
    start_time: time
    end_time: time
    default_meeting_url: str | None = None


class ClassScheduleUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    default_meeting_url: str | None = None
    is_active: bool | None = None


class ClassScheduleOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    day_of_week: int
    start_time: time
    end_time: time
    default_meeting_url: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class GenerateSessionsRequest(BaseModel):
    start_date: date
    end_date: date


class OnlineClassCreate(BaseModel):
    """The ad-hoc "Create Online Class" form — a single dated session (class_schedule_id stays
    null, same as any other one-off session) that also gets a Google Meet link generated for it
    immediately, unlike the bulk sessions/generate endpoint which is for recurring weekly slots."""

    section_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    session_date: date
    start_time: time
    end_time: time
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    # Optional: notify every active student in the section via exactly one of the app's existing
    # channels once the class (and its Meet link, if generated) is ready — reuses
    # NotificationService.send_notification, so "email" sends email only, "whatsapp" sends
    # WhatsApp only, matching the same one-channel-per-selection rule used everywhere else.
    notify_channel: NotificationChannel | None = None


class ClassSessionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    meeting_url: str | None = None
    session_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    status: SessionStatus | None = None
    cancellation_reason: str | None = None


class ClassSessionOut(BaseModel):
    id: uuid.UUID
    class_schedule_id: uuid.UUID | None
    section_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    session_date: date
    start_time: time
    end_time: time
    title: str | None
    description: str | None
    meeting_url: str | None
    status: SessionStatus
    actual_start_at: datetime | None
    actual_end_at: datetime | None
    cancellation_reason: str | None
    google_event_id: str | None
    meet_link: str | None
    google_calendar_id: str | None
    meeting_status: MeetingStatus

    model_config = {"from_attributes": True}
