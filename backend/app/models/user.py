import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"


class User(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Defaults to True because most users are admin-provisioned (a teacher/student/parent never
    # clicks a link themselves) — only the self-service tenant-onboarding admin is created
    # unverified and actually goes through the email-verification flow.
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_verification_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_reset_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AdminProfile(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "admin_profiles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, unique=True)


class TeacherProfile(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "teacher_profiles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, unique=True)
    employee_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    hire_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(255), nullable=True)


class StudentProfile(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "student_profiles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, unique=True)
    roll_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    class_grade_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("class_grades.id"), nullable=True, index=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("sections.id"), nullable=True)
    family_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("families.id"), nullable=True, index=True)
    admission_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    admission_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    date_of_birth: Mapped[Date | None] = mapped_column(Date, nullable=True)
    guardian_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    withdrawal_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    withdrawal_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    __table_args__ = (UniqueConstraint("tenant_id", "admission_number", name="uq_student_tenant_admission_number"),)


class ParentProfile(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "parent_profiles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, unique=True)
    whatsapp_opt_in: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sms_opt_in: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ParentStudentLink(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "parent_student_links"
    __table_args__ = (UniqueConstraint("parent_id", "student_id", name="uq_parent_student"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    parent_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("parent_profiles.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("student_profiles.id"), nullable=False)
    relationship_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
