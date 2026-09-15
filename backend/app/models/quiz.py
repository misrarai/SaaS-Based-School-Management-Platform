import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class QuestionType(str, enum.Enum):
    MCQ_SINGLE = "mcq_single"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"


class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"  # submitted; if the quiz has short-answer questions, still awaiting manual grading
    GRADED = "graded"  # every question graded — score/percentage/grade are final


class Quiz(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "quizzes"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    section_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=False, index=True
    )
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("chapters.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class QuizQuestion(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "quiz_questions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    quiz_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("quizzes.id"), nullable=False, index=True)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    marks: Mapped[float] = mapped_column(Numeric(10, 2), default=1, nullable=False)


class QuizOption(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "quiz_options"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("quiz_questions.id"), nullable=False, index=True
    )
    option_text: Mapped[str] = mapped_column(String(500), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class QuizAttempt(UUIDPKMixin, TimestampMixin, Base):
    """One attempt per student per quiz (kept simple for MVP — no retakes)."""

    __tablename__ = "quiz_attempts"
    __table_args__ = (UniqueConstraint("tenant_id", "quiz_id", "student_id", name="uq_attempt_quiz_student"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    quiz_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("quizzes.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    max_score: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[AttemptStatus] = mapped_column(Enum(AttemptStatus), default=AttemptStatus.IN_PROGRESS, nullable=False)


class QuizAnswer(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "quiz_answers"
    __table_args__ = (UniqueConstraint("tenant_id", "attempt_id", "question_id", name="uq_answer_attempt_question"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    attempt_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("quiz_attempts.id"), nullable=False, index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("quiz_questions.id"), nullable=False, index=True
    )
    selected_option_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("quiz_options.id"), nullable=True
    )
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # None until graded — MCQ/True-False are graded immediately on submit; short-answer stays
    # None until a teacher grades it via POST /quizzes/attempts/{id}/grade.
    marks_awarded: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
