import enum
import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"


class Attendance(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("tenant_id", "class_session_id", "student_id", name="uq_attendance_session_student"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    class_session_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("class_sessions.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus), nullable=False)
    marked_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)


class HrAttendanceStatus(str, enum.Enum):
    """Shared by TeacherAttendance and StaffAttendance — one status vocabulary for "did this
    person come to work today", distinct from the student/class AttendanceStatus above."""

    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"
    LEAVE = "leave"


class TeacherAttendance(UUIDPKMixin, TimestampMixin, Base):
    """One row per teacher per day. Normally created by the teacher's own check-in (check_in_at
    set, status PRESENT) and completed by their check-out — self-service, since every teacher
    already has a login. marked_by_user_id is null for a self check-in and set to the admin's id
    when an admin overrides/backfills a day (e.g. marking a teacher ABSENT or on LEAVE for a day
    they never checked in)."""

    __tablename__ = "teacher_attendances"
    __table_args__ = (
        UniqueConstraint("tenant_id", "teacher_id", "attendance_date", name="uq_teacher_attendance_tenant_teacher_date"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=False, index=True
    )
    attendance_date: Mapped[date_] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[HrAttendanceStatus] = mapped_column(Enum(HrAttendanceStatus), nullable=False)
    check_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    check_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    marked_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)


class StaffAttendance(UUIDPKMixin, TimestampMixin, Base):
    """One row per non-teaching staff member per day. Staff have no login (see the Staff model),
    so unlike teachers there is no self-service path here — every row is admin-marked, same
    "daily register" pattern as a teacher marking a class's student attendance."""

    __tablename__ = "staff_attendances"
    __table_args__ = (
        UniqueConstraint("tenant_id", "staff_id", "attendance_date", name="uq_staff_attendance_tenant_staff_date"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    staff_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("staff.id"), nullable=False, index=True)
    attendance_date: Mapped[date_] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[HrAttendanceStatus] = mapped_column(Enum(HrAttendanceStatus), nullable=False)
    marked_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
