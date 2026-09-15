import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class Assignment(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "assignments"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    section_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions_file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    max_marks: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)


class AssignmentSubmission(UUIDPKMixin, TimestampMixin, Base):
    """Gradebook is a derived query over these rows — no separate grades table."""

    __tablename__ = "assignment_submissions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "assignment_id", "student_id", name="uq_submission_assignment_student"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("assignments.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    submitted_file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_late: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    marks_obtained: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    teacher_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    graded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
