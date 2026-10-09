import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

ENQUIRY_STATUS_PATTERN = "^(new|follow_up|converted|closed)$"
ENQUIRY_SOURCE_PATTERN = "^(walk_in|phone|facebook|instagram|referral|website|newspaper|banner|other)$"
COMPLAINANT_PATTERN = "^(parent|student|staff|other)$"
COMPLAINT_STATUS_PATTERN = "^(open|in_progress|resolved)$"
POSTAL_TYPE_PATTERN = "^(received|dispatched)$"
CALL_TYPE_PATTERN = "^(incoming|outgoing)$"


# ---------- Admission enquiries ----------


class EnquiryCreate(BaseModel):
    student_name: str = Field(min_length=2, max_length=255)
    parent_name: str | None = None
    phone: str | None = None
    email: str | None = None
    class_grade_id: uuid.UUID | None = None
    class_interested: str | None = None
    source: str = Field(default="walk_in", pattern=ENQUIRY_SOURCE_PATTERN)
    enquiry_date: date | None = None
    follow_up_date: date | None = None
    status: str = Field(default="new", pattern=ENQUIRY_STATUS_PATTERN)
    notes: str | None = None
    assigned_to: str | None = None


class EnquiryUpdate(BaseModel):
    student_name: str | None = Field(default=None, min_length=2, max_length=255)
    parent_name: str | None = None
    phone: str | None = None
    email: str | None = None
    class_grade_id: uuid.UUID | None = None
    class_interested: str | None = None
    source: str | None = Field(default=None, pattern=ENQUIRY_SOURCE_PATTERN)
    enquiry_date: date | None = None
    follow_up_date: date | None = None
    status: str | None = Field(default=None, pattern=ENQUIRY_STATUS_PATTERN)
    notes: str | None = None
    assigned_to: str | None = None


class EnquiryOut(BaseModel):
    id: uuid.UUID
    student_name: str
    parent_name: str | None
    phone: str | None
    email: str | None
    class_grade_id: uuid.UUID | None
    class_interested: str | None
    source: str
    enquiry_date: date
    follow_up_date: date | None
    status: str
    notes: str | None
    assigned_to: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FollowUpCreate(BaseModel):
    note: str = Field(min_length=1)
    follow_up_date: date | None = None
    next_follow_up_date: date | None = None
    status: str | None = Field(default=None, pattern=ENQUIRY_STATUS_PATTERN)


class FollowUpOut(BaseModel):
    id: uuid.UUID
    enquiry_id: uuid.UUID
    follow_up_date: date
    note: str
    next_follow_up_date: date | None
    created_by_user_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EnquirySummary(BaseModel):
    total: int
    new: int
    follow_up: int
    converted: int
    closed: int
    due_follow_ups_today: int


class EnquiryConversionPrefill(BaseModel):
    """Prefill payload for the student admission form (POST /students)."""

    enquiry_id: uuid.UUID
    full_name: str
    guardian_name: str | None
    email: str | None
    phone: str | None
    class_grade_id: uuid.UUID | None
    class_interested: str | None
    admission_detail: dict


# ---------- Visitors ----------


class VisitorCreate(BaseModel):
    visitor_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    cnic: str | None = None
    purpose: str = Field(min_length=1, max_length=255)
    person_to_meet: str | None = None
    number_of_persons: int = Field(default=1, ge=1, le=100)
    in_time: datetime | None = None
    out_time: datetime | None = None
    notes: str | None = None


class VisitorUpdate(BaseModel):
    visitor_name: str | None = None
    phone: str | None = None
    cnic: str | None = None
    purpose: str | None = None
    person_to_meet: str | None = None
    number_of_persons: int | None = Field(default=None, ge=1, le=100)
    in_time: datetime | None = None
    out_time: datetime | None = None
    notes: str | None = None


class VisitorOut(BaseModel):
    id: uuid.UUID
    visitor_name: str
    phone: str | None
    cnic: str | None
    purpose: str
    person_to_meet: str | None
    number_of_persons: int
    in_time: datetime
    out_time: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}


# ---------- Complaints ----------


class ComplaintCreate(BaseModel):
    complainant_type: str = Field(default="parent", pattern=COMPLAINANT_PATTERN)
    complainant_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    complaint_type: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    complaint_date: date | None = None
    assigned_to: str | None = None
    action_taken: str | None = None
    status: str = Field(default="open", pattern=COMPLAINT_STATUS_PATTERN)


class ComplaintUpdate(BaseModel):
    complainant_type: str | None = Field(default=None, pattern=COMPLAINANT_PATTERN)
    complainant_name: str | None = None
    phone: str | None = None
    complaint_type: str | None = None
    description: str | None = None
    complaint_date: date | None = None
    assigned_to: str | None = None
    action_taken: str | None = None
    status: str | None = Field(default=None, pattern=COMPLAINT_STATUS_PATTERN)


class ComplaintOut(BaseModel):
    id: uuid.UUID
    complainant_type: str
    complainant_name: str
    phone: str | None
    complaint_type: str
    description: str
    complaint_date: date
    assigned_to: str | None
    action_taken: str | None
    status: str

    model_config = {"from_attributes": True}


# ---------- Postal ----------


class PostalCreate(BaseModel):
    record_type: str = Field(pattern=POSTAL_TYPE_PATTERN)
    title: str = Field(min_length=1, max_length=255)
    reference_no: str | None = None
    from_title: str | None = None
    to_title: str | None = None
    record_date: date | None = None
    notes: str | None = None


class PostalUpdate(BaseModel):
    record_type: str | None = Field(default=None, pattern=POSTAL_TYPE_PATTERN)
    title: str | None = None
    reference_no: str | None = None
    from_title: str | None = None
    to_title: str | None = None
    record_date: date | None = None
    notes: str | None = None


class PostalOut(BaseModel):
    id: uuid.UUID
    record_type: str
    title: str
    reference_no: str | None
    from_title: str | None
    to_title: str | None
    record_date: date
    notes: str | None

    model_config = {"from_attributes": True}


# ---------- Gate passes ----------


class GatePassCreate(BaseModel):
    student_id: uuid.UUID | None = None
    admission_number: str | None = None
    reason: str = Field(min_length=1, max_length=500)
    guardian_name: str = Field(min_length=2, max_length=255)
    guardian_relation: str | None = None
    guardian_cnic: str | None = None
    guardian_phone: str | None = None
    out_time: datetime | None = None
    approved_by: str | None = None


class GatePassOut(BaseModel):
    id: uuid.UUID
    pass_number: int
    student_id: uuid.UUID
    student_name: str
    admission_number: str | None
    class_name: str | None
    section_name: str | None
    reason: str
    guardian_name: str
    guardian_relation: str | None
    guardian_cnic: str | None
    guardian_phone: str | None
    out_time: datetime
    approved_by: str | None


class StudentLookupOut(BaseModel):
    student_id: uuid.UUID
    full_name: str
    admission_number: str | None
    class_name: str | None
    section_name: str | None
    guardian_name: str | None


# ---------- Phone call log ----------


class CallCreate(BaseModel):
    caller_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    purpose: str = Field(min_length=1, max_length=255)
    call_date: date | None = None
    call_type: str = Field(default="incoming", pattern=CALL_TYPE_PATTERN)
    follow_up_date: date | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    notes: str | None = None


class CallUpdate(BaseModel):
    caller_name: str | None = None
    phone: str | None = None
    purpose: str | None = None
    call_date: date | None = None
    call_type: str | None = Field(default=None, pattern=CALL_TYPE_PATTERN)
    follow_up_date: date | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    notes: str | None = None


class CallOut(BaseModel):
    id: uuid.UUID
    caller_name: str
    phone: str | None
    purpose: str
    call_date: date
    call_type: str
    follow_up_date: date | None
    duration_minutes: int | None
    notes: str | None

    model_config = {"from_attributes": True}
