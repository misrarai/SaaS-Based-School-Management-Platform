import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

NOTICE_AUDIENCE_PATTERN = "^(all|staff|students|parents|classes)$"
EVENT_AUDIENCE_PATTERN = "^(all|staff|students|parents)$"
EVENT_TYPE_PATTERN = "^(holiday|event|exam|meeting)$"


# ---------- Notices ----------


class NoticeCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    body: str = Field(min_length=1)
    audience: str = Field(default="all", pattern=NOTICE_AUDIENCE_PATTERN)
    class_ids: list[uuid.UUID] | None = None
    publish_date: date | None = None
    expiry_date: date | None = None
    attachment_url: str | None = None
    is_pinned: bool = False


class NoticeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    body: str | None = None
    audience: str | None = Field(default=None, pattern=NOTICE_AUDIENCE_PATTERN)
    class_ids: list[uuid.UUID] | None = None
    publish_date: date | None = None
    expiry_date: date | None = None
    attachment_url: str | None = None
    is_pinned: bool | None = None


class NoticeOut(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    audience: str
    class_ids: list[uuid.UUID] | None
    publish_date: date
    expiry_date: date | None
    attachment_url: str | None
    is_pinned: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Diary ----------


class DiaryCreate(BaseModel):
    class_grade_id: uuid.UUID
    section_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    diary_date: date | None = None
    homework: str = Field(min_length=1)
    attachment_url: str | None = None


class DiaryUpdate(BaseModel):
    section_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    diary_date: date | None = None
    homework: str | None = Field(default=None, min_length=1)
    attachment_url: str | None = None


class DiaryOut(BaseModel):
    id: uuid.UUID
    class_grade_id: uuid.UUID
    class_name: str | None
    section_id: uuid.UUID | None
    section_name: str | None
    subject_id: uuid.UUID | None
    subject_name: str | None
    diary_date: date
    homework: str
    attachment_url: str | None
    posted_by_user_id: uuid.UUID
    posted_by_name: str | None


# ---------- Messages ----------


class ContactOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    role: str
    email: str


class ThreadCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    participant_user_ids: list[uuid.UUID] = Field(min_length=1)
    body: str = Field(min_length=1)


class MessageCreate(BaseModel):
    body: str = Field(min_length=1)


class ParticipantOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    role: str


class MessageOut(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    sender_user_id: uuid.UUID
    sender_name: str
    body: str
    created_at: datetime
    is_mine: bool


class ThreadOut(BaseModel):
    id: uuid.UUID
    subject: str
    created_by_user_id: uuid.UUID
    last_message_at: datetime
    last_message_preview: str | None
    unread_count: int
    participants: list[ParticipantOut]


class ThreadDetailOut(ThreadOut):
    messages: list[MessageOut]


class UnreadCountOut(BaseModel):
    unread: int


# ---------- Events ----------


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = None
    start_date: date
    end_date: date | None = None
    event_type: str = Field(default="event", pattern=EVENT_TYPE_PATTERN)
    audience: str = Field(default="all", pattern=EVENT_AUDIENCE_PATTERN)


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    event_type: str | None = Field(default=None, pattern=EVENT_TYPE_PATTERN)
    audience: str | None = Field(default=None, pattern=EVENT_AUDIENCE_PATTERN)


class EventOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    start_date: date
    end_date: date
    event_type: str
    audience: str

    model_config = {"from_attributes": True}


# ---------- To-do ----------


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    due_date: date | None = None


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    due_date: date | None = None
    is_done: bool | None = None


class TodoOut(BaseModel):
    id: uuid.UUID
    title: str
    due_date: date | None
    is_done: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- SMS ----------


class SmsSendRequest(BaseModel):
    audience: str = Field(pattern="^(all_parents|class_parents)$")
    class_grade_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    message: str = Field(min_length=1, max_length=1000)
    email_fallback: bool = True


class SmsSendResult(BaseModel):
    recipients: int
    sms_sent: int
    sms_skipped: int
    sms_failed: int
    email_sent: int
    email_skipped: int


class CommunicationLogOut(BaseModel):
    id: uuid.UUID
    channel: str
    audience: str
    recipient_user_id: uuid.UUID | None
    recipient_name: str | None
    recipient_address: str | None
    message: str
    status: str
    detail: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
