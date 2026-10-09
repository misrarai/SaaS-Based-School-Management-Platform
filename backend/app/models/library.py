"""Library module: catalogue (categories, books, copies), members, circulation (issues/returns/fines)
and reservations. Everything is tenant-scoped via tenant_id."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin, utcnow

COPY_STATUSES = ("available", "issued", "lost", "damaged", "reserved")
MEMBER_TYPES = ("student", "teacher", "staff")


class LibrarySettings(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "library_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, unique=True)
    student_loan_days: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    teacher_loan_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    staff_loan_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    student_max_books: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    teacher_max_books: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    staff_max_books: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    fine_per_day: Mapped[float] = mapped_column(Numeric(10, 2), default=5, nullable=False)
    max_renewals: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    reservation_hold_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)


class BookCategory(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "library_book_categories"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_library_category_tenant_name"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Book(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "library_books"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    isbn: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(255), nullable=True)
    edition: Mapped[str | None] = mapped_column(String(50), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("library_book_categories.id"), nullable=True, index=True
    )
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rack_location: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)


class BookCopy(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "library_book_copies"
    __table_args__ = (UniqueConstraint("tenant_id", "accession_number", name="uq_library_copy_tenant_accession"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    book_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("library_books.id"), nullable=False, index=True)
    accession_number: Mapped[str] = mapped_column(String(50), nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="available", nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)


class LibraryMember(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "library_members"
    __table_args__ = (UniqueConstraint("tenant_id", "card_number", name="uq_library_member_tenant_card"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    member_type: Mapped[str] = mapped_column(String(20), nullable=False)
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("student_profiles.id"), nullable=True, index=True
    )
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("teacher_profiles.id"), nullable=True, index=True
    )
    staff_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("staff.id"), nullable=True, index=True)
    card_number: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    joined_on: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)


class BookIssue(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "library_book_issues"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    copy_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("library_book_copies.id"), nullable=False, index=True)
    book_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("library_books.id"), nullable=False, index=True)
    member_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("library_members.id"), nullable=False, index=True)
    issued_on: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    returned_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    return_condition: Mapped[str | None] = mapped_column(String(20), nullable=True)
    renewals_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # issued | returned | lost
    status: Mapped[str] = mapped_column(String(20), default="issued", nullable=False)
    fine_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    # none | unpaid | paid | waived
    fine_status: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    fine_paid_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    issued_by_user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(255), nullable=True)


class BookReservation(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "library_book_reservations"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    book_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("library_books.id"), nullable=False, index=True)
    member_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("library_members.id"), nullable=False, index=True)
    reserved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    # pending | ready | fulfilled | cancelled | expired
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    copy_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("library_book_copies.id"), nullable=True)
    ready_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True)
