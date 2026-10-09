"""Examinations: grading schemes, exam terms, datesheets, marks and per-student result remarks.

Results (totals, %, grade, positions, pass/fail) are never stored — they are computed on demand
from ExamMark + ExamSchedule (total/passing marks) + the exam's GradingScheme, so editing a mark
or a band is reflected everywhere immediately.
"""

import uuid
from datetime import date as date_
from datetime import time as time_

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class ExamStatus:
    DRAFT = "draft"
    PUBLISHED = "published"


class GradingScheme(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "exam_grading_schemes"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_exam_grading_scheme_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class GradingBand(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "exam_grading_bands"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    scheme_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("exam_grading_schemes.id"), nullable=False, index=True
    )
    min_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    max_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    grade: Mapped[str] = mapped_column(String(10), nullable=False)
    gpa: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(100), nullable=True)


class Exam(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "exams"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    academic_year: Mapped[str | None] = mapped_column(String(20), nullable=True)
    academic_year_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("academic_years.id"), nullable=True, index=True
    )
    start_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    grading_scheme_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("exam_grading_schemes.id"), nullable=True
    )
    # draft = only staff see it; published = datesheet visible to students/parents.
    status: Mapped[str] = mapped_column(String(20), default=ExamStatus.DRAFT, nullable=False)
    # Results are visible to students/parents only once this is switched on.
    results_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ExamClass(UUIDPKMixin, TimestampMixin, Base):
    """Which classes take part in an exam."""

    __tablename__ = "exam_classes"
    __table_args__ = (UniqueConstraint("exam_id", "class_grade_id", name="uq_exam_class"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    exam_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("exams.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False)


class ExamSchedule(UUIDPKMixin, TimestampMixin, Base):
    """One datesheet row: a subject paper for a class within an exam."""

    __tablename__ = "exam_schedules"
    __table_args__ = (
        UniqueConstraint("exam_id", "class_grade_id", "subject_id", name="uq_exam_schedule_class_subject"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    exam_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("exams.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=False)
    exam_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[time_ | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time_ | None] = mapped_column(Time, nullable=True)
    total_marks: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    passing_marks: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    room: Mapped[str | None] = mapped_column(String(50), nullable=True)


class ExamMark(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "exam_marks"
    __table_args__ = (UniqueConstraint("exam_id", "subject_id", "student_id", name="uq_exam_mark_subject_student"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    exam_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("exams.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False)
    section_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    obtained_marks: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    is_absent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    remarks: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class ExamStudentRemark(UUIDPKMixin, TimestampMixin, Base):
    """Overall remarks printed on a student's result card for an exam."""

    __tablename__ = "exam_student_remarks"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_exam_student_remark"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    exam_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("exams.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("student_profiles.id"), nullable=False)
    remarks: Mapped[str] = mapped_column(String(500), nullable=False)
