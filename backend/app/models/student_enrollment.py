import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class StudentEnrollment(UUIDPKMixin, TimestampMixin, Base):
    """Enrollment history row — one per (student, class) assignment.
    status='active' means the current placement; 'previous' means a prior
    placement that ended via class change or promotion; 'withdrawn' means
    the student left school while in this class."""

    __tablename__ = "student_enrollments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False)
    section_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=True)
    academic_year_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("academic_years.id"), nullable=True)
    enrolled_at: Mapped[date] = mapped_column(Date, nullable=False)
    left_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
