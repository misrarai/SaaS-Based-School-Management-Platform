import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class AcademicYear(UUIDPKMixin, TimestampMixin, Base):
    """The top of the hierarchy — e.g. "2026". Grades, and through them Courses, hang off a
    specific year so the same Grade 9 / Section A / Mathematics combination can exist again,
    cleanly, the following year without colliding with last year's roster."""

    __tablename__ = "academic_years"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_academic_year_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ClassGrade(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "class_grades"
    __table_args__ = (UniqueConstraint("tenant_id", "name", "academic_year", name="uq_class_grade_tenant_name_year"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    level_order: Mapped[int] = mapped_column(Integer, nullable=False)
    # Kept as free text for backward compatibility with every existing caller of POST /classes.
    # New callers should also pass academic_year_id, which is the real FK relationship going
    # forward — the service keeps this string in sync with AcademicYear.name when an id is given.
    academic_year: Mapped[str] = mapped_column(String(20), nullable=False)
    academic_year_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("academic_years.id"), nullable=True, index=True
    )


class Section(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "sections"
    __table_args__ = (UniqueConstraint("class_grade_id", "name", name="uq_section_class_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)


class Subject(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("class_grade_id", "code", name="uq_subject_class_code"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    class_grade_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
