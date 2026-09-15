import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.attendance import AttendanceStatus, HrAttendanceStatus


class AttendanceRecordIn(BaseModel):
    student_id: uuid.UUID
    status: AttendanceStatus
    note: str | None = None


class AttendanceMarkRequest(BaseModel):
    records: list[AttendanceRecordIn]


class AttendanceOut(BaseModel):
    id: uuid.UUID
    class_session_id: uuid.UUID
    student_id: uuid.UUID
    status: AttendanceStatus
    marked_by_user_id: uuid.UUID
    marked_at: datetime
    note: str | None

    model_config = {"from_attributes": True}


class RosterEntryOut(BaseModel):
    student_id: uuid.UUID
    full_name: str
    roll_number: str | None
    status: AttendanceStatus | None
    note: str | None


class AttendanceSummaryOut(BaseModel):
    present: int
    absent: int
    late: int
    excused: int
    total: int
    percentage: float


class AttendanceAnalyticsOut(BaseModel):
    present: int
    absent: int
    late: int
    excused: int
    total: int
    percentage: float


class HrAttendanceSummaryOut(BaseModel):
    """Shared shape for both teacher and staff attendance aggregates."""

    present: int
    absent: int
    late: int
    half_day: int
    leave: int
    total: int
    percentage: float


class TeacherAttendanceOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    attendance_date: date
    status: HrAttendanceStatus
    check_in_at: datetime | None
    check_out_at: datetime | None
    marked_by_user_id: uuid.UUID | None
    note: str | None

    model_config = {"from_attributes": True}


class TeacherAttendanceDetailOut(TeacherAttendanceOut):
    """TeacherAttendanceOut plus the teacher's name — resolved server-side for the admin's daily
    list so the frontend doesn't need a separate teacher lookup/join."""

    teacher_name: str


class AdminMarkTeacherAttendanceRequest(BaseModel):
    teacher_id: uuid.UUID
    attendance_date: date
    status: HrAttendanceStatus
    note: str | None = None


class StaffAttendanceOut(BaseModel):
    id: uuid.UUID
    staff_id: uuid.UUID
    attendance_date: date
    status: HrAttendanceStatus
    marked_by_user_id: uuid.UUID
    marked_at: datetime
    note: str | None

    model_config = {"from_attributes": True}


class StaffAttendanceDetailOut(StaffAttendanceOut):
    staff_name: str
    designation: str


class MarkStaffAttendanceRequest(BaseModel):
    staff_id: uuid.UUID
    attendance_date: date
    status: HrAttendanceStatus
    note: str | None = None


class StaffAttendanceRecordIn(BaseModel):
    staff_id: uuid.UUID
    status: HrAttendanceStatus
    note: str | None = None


class BulkMarkStaffAttendanceRequest(BaseModel):
    """The admin's "daily register" — one status per staff member for a single date."""

    attendance_date: date
    records: list[StaffAttendanceRecordIn] = Field(min_length=1)


class StaffDailyRosterEntryOut(BaseModel):
    """One row per active staff member for a given date — their existing mark if any, so the
    admin's register UI can pre-fill instead of starting blank every day."""

    staff_id: uuid.UUID
    full_name: str
    designation: str
    status: HrAttendanceStatus | None
    note: str | None
