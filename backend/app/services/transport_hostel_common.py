"""Helpers shared by the transport and hostel services: resolving which students a portal user
may see, building student-name lookups, and issuing standalone monthly invoices."""

import calendar
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.fee import Invoice, InvoiceType
from app.models.user import RoleEnum, StudentProfile, User
from app.repositories.fee_repo import InvoiceRepository
from app.repositories.parent_repo import ParentProfileRepository, ParentStudentLinkRepository
from app.repositories.student_repo import StudentProfileRepository

MONTH_NAMES = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


def month_bounds(month: int, year: int) -> tuple[date, date]:
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def visible_student_ids(db: Session, user: User) -> list[uuid.UUID]:
    """Students the current portal user is allowed to see: a student sees only themselves, a
    parent sees their linked children."""
    if user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(user.tenant_id, user.id)
        return [profile.id] if profile else []
    if user.role == RoleEnum.PARENT:
        parent = ParentProfileRepository(db).get_by_user_id(user.tenant_id, user.id)
        if parent is None:
            return []
        return ParentStudentLinkRepository(db).list_student_ids(user.tenant_id, parent.id)
    return []


def assert_can_view_student(db: Session, user: User, student_id: uuid.UUID) -> None:
    if user.role == RoleEnum.ADMIN:
        if StudentProfileRepository(db).get_by_id(user.tenant_id, student_id) is None:
            raise NotFoundError("Student not found")
        return
    if student_id not in visible_student_ids(db, user):
        raise ForbiddenError("You may not view this student")


def student_names(db: Session, tenant_id: uuid.UUID, student_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not student_ids:
        return {}
    stmt = (
        select(StudentProfile.id, User.full_name)
        .join(User, User.id == StudentProfile.user_id)
        .where(StudentProfile.tenant_id == tenant_id, StudentProfile.id.in_(set(student_ids)))
    )
    return {row[0]: row[1] for row in db.execute(stmt).all()}


def get_student_or_404(db: Session, tenant_id: uuid.UUID, student_id: uuid.UUID) -> StudentProfile:
    student = StudentProfileRepository(db).get_by_id(tenant_id, student_id)
    if student is None:
        raise NotFoundError("Student not found")
    return student


def issue_other_invoice(
    db: Session,
    tenant_id: uuid.UUID,
    student: StudentProfile,
    amount: float,
    due_date: date,
    notes: str,
) -> Invoice:
    """Creates an OTHER-type invoice. period_month/period_year are deliberately left NULL: the
    invoices table has a unique key on (student, type, month, year), and transport + hostel +
    any other OTHER charge for the same month would collide. Per-month dedupe is handled by the
    module's own *FeeRecord link table instead; the month is carried in `notes`."""
    invoices = InvoiceRepository(db)
    return invoices.create(
        Invoice(
            tenant_id=tenant_id,
            student_id=student.id,
            class_grade_id=student.class_grade_id,
            invoice_type=InvoiceType.OTHER,
            invoice_number=invoices.next_invoice_number(tenant_id),
            period_month=None,
            period_year=None,
            amount_due=amount,
            discount_amount=0,
            net_amount=amount,
            due_date=due_date,
            notes=notes,
        )
    )
