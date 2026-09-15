import enum
import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class Course(UUIDPKMixin, TimestampMixin, Base):
    """The concrete offering that ties the hierarchy together: one Subject, taught to one
    Section, within one AcademicYear. class_grade_id is denormalized from section_id purely to
    make listing/filtering by grade a single indexed lookup instead of a join."""

    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("academic_year_id", "section_id", "subject_id", name="uq_course_year_section_subject"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("academic_years.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False, index=True)
    section_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class TeacherAssignment(UUIDPKMixin, TimestampMixin, Base):
    """Who teaches a Course. Replaces the never-populated TeacherSubject/TeacherSection tables
    with a single record tied to the actual course offering; more than one teacher can be
    assigned to the same course (co-teaching), each as their own row."""

    __tablename__ = "teacher_assignments"
    __table_args__ = (UniqueConstraint("course_id", "teacher_id", name="uq_teacher_assignment_course_teacher"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("courses.id"), nullable=False, index=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("teacher_profiles.id"), nullable=False, index=True)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class EnrollmentStatus(str, enum.Enum):
    ACTIVE = "active"
    DROPPED = "dropped"


class CourseEnrollment(UUIDPKMixin, TimestampMixin, Base):
    """Which students are in a Course. A Course is created with every current, active student
    of its Section auto-enrolled (the common case — a compulsory subject); individual rows can
    then be dropped or added for electives without touching Section membership itself."""

    __tablename__ = "course_enrollments"
    __table_args__ = (UniqueConstraint("course_id", "student_id", name="uq_course_enrollment_course_student"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("courses.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True)
    enrolled_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[EnrollmentStatus] = mapped_column(Enum(EnrollmentStatus), default=EnrollmentStatus.ACTIVE, nullable=False)


class Chapter(UUIDPKMixin, TimestampMixin, Base):
    """A unit within a Course (e.g. "Chapter 1: Algebra") that Resources (video/notes/
    worksheet) and Quizzes hang off via their own optional chapter_id — this is what lets a
    student open a course and see content grouped exactly by chapter."""

    __tablename__ = "chapters"
    __table_args__ = (UniqueConstraint("course_id", "title", name="uq_chapter_course_title"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("courses.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
