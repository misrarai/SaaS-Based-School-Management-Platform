"""Front-office registers: admission enquiries (with a follow-up log), visitor book,
complaints, postal receive/dispatch register, student gate passes and the phone call log.
Every table is tenant-scoped like the rest of the schema."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin

ENQUIRY_STATUSES = ("new", "follow_up", "converted", "closed")
COMPLAINT_STATUSES = ("open", "in_progress", "resolved")


class AdmissionEnquiry(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "admission_enquiries"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    class_grade_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=True)
    class_interested: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="walk_in", nullable=False)
    enquiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)


class EnquiryFollowUp(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "enquiry_follow_ups"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("admission_enquiries.id"), nullable=False, index=True
    )
    follow_up_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    next_follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class VisitorLog(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "visitor_logs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    visitor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cnic: Mapped[str | None] = mapped_column(String(30), nullable=True)
    purpose: Mapped[str] = mapped_column(String(255), nullable=False)
    person_to_meet: Mapped[str | None] = mapped_column(String(255), nullable=True)
    number_of_persons: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    out_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Complaint(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "complaints"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    complainant_type: Mapped[str] = mapped_column(String(20), default="parent", nullable=False)
    complainant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    complaint_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    complaint_date: Mapped[date] = mapped_column(Date, nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False, index=True)


class PostalRecord(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "postal_records"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    record_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # received | dispatched
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    from_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    to_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class GatePass(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "gate_passes"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    pass_number: Mapped[int] = mapped_column(Integer, nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("student_profiles.id"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    guardian_name: Mapped[str] = mapped_column(String(255), nullable=False)
    guardian_relation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    guardian_cnic: Mapped[str | None] = mapped_column(String(30), nullable=True)
    guardian_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    out_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)


class PhoneCallLog(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "phone_call_logs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    caller_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    purpose: Mapped[str] = mapped_column(String(255), nullable=False)
    call_date: Mapped[date] = mapped_column(Date, nullable=False)
    call_type: Mapped[str] = mapped_column(String(20), default="incoming", nullable=False)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
