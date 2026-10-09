import calendar
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.attendance import Attendance, AttendanceStatus, HrAttendanceStatus
from app.models.fee import Invoice, InvoiceStatus, Payment, PaymentVerificationStatus
from app.models.notification import NotificationChannel, NotificationLog, NotificationStatus
from app.models.payout import PayoutStatus, TeacherPayout
from app.models.schedule import ClassSession
from app.models.staff import Staff
from app.models.user import StudentProfile, TeacherProfile, User
from app.repositories.attendance_repo import StaffAttendanceRepository, TeacherAttendanceRepository

OPEN_INVOICE_STATUSES = (InvoiceStatus.PENDING, InvoiceStatus.OVERDUE)

# A student can attend several sessions in a day; each student is counted once using their
# best status for the day.
_STUDENT_STATUS_RANK = {
    AttendanceStatus.PRESENT: 4,
    AttendanceStatus.LATE: 3,
    AttendanceStatus.EXCUSED: 2,
    AttendanceStatus.ABSENT: 1,
}


def _day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


def _as_date(value: datetime | date) -> date:
    return value.date() if isinstance(value, datetime) else value


class DashboardOverviewBuilder:
    """Builds the extended admin dashboard overview: headline tiles, receivable/payable
    figures, today's attendance breakdowns, messaging usage and month-to-date charts.
    Read-only aggregation over existing tables, always scoped to one tenant."""

    def __init__(self, db: Session):
        self.db = db
        self.teacher_attendance = TeacherAttendanceRepository(db)
        self.staff_attendance = StaffAttendanceRepository(db)

    def _count(self, stmt) -> int:
        return int(self.db.execute(stmt).scalar() or 0)

    def _sum(self, stmt) -> float:
        return float(self.db.execute(stmt).scalar() or 0)

    def _open_invoices(self, tenant_id: uuid.UUID) -> list[Invoice]:
        stmt = select(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.status.in_(OPEN_INVOICE_STATUSES))
        return list(self.db.execute(stmt).scalars().all())

    @staticmethod
    def _invoice_month(invoice: Invoice) -> tuple[int, int]:
        """(year, month) an invoice belongs to — its billing period, or its due date for
        admission / one-off invoices that have no period."""
        if invoice.period_year and invoice.period_month:
            return invoice.period_year, invoice.period_month
        return invoice.due_date.year, invoice.due_date.month

    def _verified_payments(self, tenant_id: uuid.UUID, start: datetime, end: datetime) -> list[tuple[datetime, float]]:
        stamp = func.coalesce(Payment.verified_at, Payment.submitted_at)
        rows = self.db.execute(
            select(stamp, Payment.amount).where(
                Payment.tenant_id == tenant_id,
                Payment.verification_status == PaymentVerificationStatus.VERIFIED,
                stamp >= start,
                stamp < end,
            )
        ).all()
        return [(when, float(amount or 0)) for when, amount in rows]

    def _student_attendance(self, tenant_id: uuid.UUID, today: date, active_students: int) -> dict:
        rows = self.db.execute(
            select(Attendance.student_id, Attendance.status)
            .join(ClassSession, ClassSession.id == Attendance.class_session_id)
            .where(Attendance.tenant_id == tenant_id, ClassSession.session_date == today)
        ).all()
        best: dict[uuid.UUID, AttendanceStatus] = {}
        for student_id, status in rows:
            if student_id not in best or _STUDENT_STATUS_RANK[status] > _STUDENT_STATUS_RANK[best[student_id]]:
                best[student_id] = status
        counts = defaultdict(int)
        for status in best.values():
            counts[status] += 1
        return {
            "present": counts[AttendanceStatus.PRESENT],
            "absent": counts[AttendanceStatus.ABSENT],
            "late": counts[AttendanceStatus.LATE],
            "leave": counts[AttendanceStatus.EXCUSED],
            "not_marked": max(active_students - len(best), 0),
            "total": max(active_students, len(best)),
        }

    def _hr_attendance(self, tenant_id: uuid.UUID, today: date, headcount: int) -> dict:
        teacher = self.teacher_attendance.counts_for_date(tenant_id, today)
        staff = self.staff_attendance.counts_for_date(tenant_id, today)
        combined = {s: teacher.get(s, 0) + staff.get(s, 0) for s in HrAttendanceStatus}
        marked = sum(combined.values())
        return {
            "present": combined[HrAttendanceStatus.PRESENT],
            "absent": combined[HrAttendanceStatus.ABSENT],
            "late": combined[HrAttendanceStatus.LATE],
            "half_day": combined[HrAttendanceStatus.HALF_DAY],
            "leave": combined[HrAttendanceStatus.LEAVE],
            "not_marked": max(headcount - marked, 0),
            "total": max(headcount, marked),
        }

    @classmethod
    def _receivable_report(cls, open_invoices: list[Invoice], year: int) -> dict:
        months = {m: 0.0 for m in range(1, 13)}
        previous = following = 0.0
        for invoice in open_invoices:
            inv_year, inv_month = cls._invoice_month(invoice)
            amount = float(invoice.net_amount or 0)
            if inv_year < year:
                previous += amount
            elif inv_year > year:
                following += amount
            else:
                months[inv_month] += amount
        return {
            "year": year,
            "previous_balance": previous,
            "months": [{"month": m, "amount": a} for m, a in months.items()],
            "next_year_balance": following,
            "total": previous + sum(months.values()) + following,
        }

    def build(self, tenant_id: uuid.UUID, today: date) -> dict:
        db = self.db
        days_in_month = calendar.monthrange(today.year, today.month)[1]
        month_start = today.replace(day=1)
        month_start_dt = _day_start(month_start)
        month_end_dt = _day_start(month_start + timedelta(days=days_in_month))
        today_start, today_end = _day_start(today), _day_start(today + timedelta(days=1))

        # --- Headcounts ---
        students = select(func.count(StudentProfile.id)).where(StudentProfile.tenant_id == tenant_id)
        total_students_all = self._count(students)
        active_students = self._count(students.where(StudentProfile.status == "active"))
        active_families = self._count(
            select(func.count(func.distinct(StudentProfile.family_id))).where(
                StudentProfile.tenant_id == tenant_id,
                StudentProfile.status == "active",
                StudentProfile.family_id.is_not(None),
            )
        )
        teachers = select(func.count(TeacherProfile.id)).where(TeacherProfile.tenant_id == tenant_id)
        total_teachers = self._count(teachers)
        active_teachers = self._count(teachers.join(User, User.id == TeacherProfile.user_id).where(User.is_active.is_(True)))
        staff = select(func.count(Staff.id)).where(Staff.tenant_id == tenant_id)
        total_staff = self._count(staff)
        active_staff = self._count(staff.where(Staff.status == "active"))

        # --- Receivables ---
        open_invoices = self._open_invoices(tenant_id)
        this_month = (today.year, today.month)
        month_invoices = [
            inv
            for inv in db.execute(
                select(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.status != InvoiceStatus.WAIVED)
            ).scalars()
            if self._invoice_month(inv) == this_month
        ]
        fee_this_month = sum(float(inv.net_amount or 0) for inv in month_invoices)
        receivable_this_month = sum(
            float(inv.net_amount or 0) for inv in month_invoices if inv.status in OPEN_INVOICE_STATUSES
        )
        month_payments = self._verified_payments(tenant_id, month_start_dt, month_end_dt)
        received_this_month = sum(amount for _, amount in month_payments)
        total_receivable = sum(float(inv.net_amount or 0) for inv in open_invoices)

        # --- Payables: last month's staff salaries + teacher payouts ---
        last_month = month_start - timedelta(days=1)
        payouts = db.execute(
            select(TeacherPayout.calculated_amount, TeacherPayout.status).where(
                TeacherPayout.tenant_id == tenant_id,
                TeacherPayout.period_month == last_month.month,
                TeacherPayout.period_year == last_month.year,
            )
        ).all()
        staff_salaries = self._sum(
            select(func.coalesce(func.sum(Staff.salary), 0)).where(Staff.tenant_id == tenant_id, Staff.status == "active")
        )
        salary_last_month = staff_salaries + sum(float(amount or 0) for amount, _ in payouts)
        paid_last_month = sum(float(amount or 0) for amount, status in payouts if status == PayoutStatus.PAID)
        total_payable = self._sum(
            select(func.coalesce(func.sum(TeacherPayout.calculated_amount), 0)).where(
                TeacherPayout.tenant_id == tenant_id, TeacherPayout.status != PayoutStatus.PAID
            )
        )

        # --- Today's collection & verification queue ---
        today_payments = [p for p in month_payments if today_start <= _aware(p[0]) < today_end]
        pending_count, pending_amount = db.execute(
            select(func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.tenant_id == tenant_id, Payment.verification_status == PaymentVerificationStatus.PENDING
            )
        ).one()

        # --- Birthdays today ---
        birthday_rows = db.execute(
            select(User.full_name, StudentProfile.date_of_birth)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .where(
                StudentProfile.tenant_id == tenant_id,
                StudentProfile.status == "active",
                StudentProfile.date_of_birth.is_not(None),
            )
            .order_by(User.full_name)
        ).all()
        birthdays_today = [
            name for name, dob in birthday_rows if dob.month == today.month and dob.day == today.day
        ]

        # --- Messaging usage today ---
        log_rows = db.execute(
            select(NotificationLog.channel, NotificationLog.status, func.count(NotificationLog.id))
            .where(
                NotificationLog.tenant_id == tenant_id,
                NotificationLog.sent_at >= today_start,
                NotificationLog.sent_at < today_end,
            )
            .group_by(NotificationLog.channel, NotificationLog.status)
        ).all()
        messaging_today = []
        for channel in NotificationChannel:
            total = sum(n for ch, _, n in log_rows if ch == channel)
            sent = sum(n for ch, st, n in log_rows if ch == channel and st == NotificationStatus.SENT)
            messaging_today.append({"channel": channel.value, "sent": sent, "total": total})

        # --- Month-to-date charts ---
        cash_in = defaultdict(float)
        for when, amount in month_payments:
            cash_in[_as_date(when).day] += amount
        cash_out = defaultdict(float)
        for paid_at, amount in db.execute(
            select(TeacherPayout.paid_at, TeacherPayout.calculated_amount).where(
                TeacherPayout.tenant_id == tenant_id,
                TeacherPayout.status == PayoutStatus.PAID,
                TeacherPayout.paid_at >= month_start_dt,
                TeacherPayout.paid_at < month_end_dt,
            )
        ).all():
            cash_out[_as_date(paid_at).day] += float(amount or 0)

        month_end = month_start.replace(day=days_in_month)
        admitted = defaultdict(int)
        withdrawn = defaultdict(int)
        for admission_date, withdrawal_date in db.execute(
            select(StudentProfile.admission_date, StudentProfile.withdrawal_date).where(
                StudentProfile.tenant_id == tenant_id
            )
        ).all():
            if admission_date and month_start <= admission_date <= month_end:
                admitted[admission_date.day] += 1
            if withdrawal_date and month_start <= withdrawal_date <= month_end:
                withdrawn[withdrawal_date.day] += 1

        days = range(1, days_in_month + 1)
        return {
            "total_students_all": total_students_all,
            "active_families": active_families,
            "active_staff_all": active_teachers + active_staff,
            "total_staff_all": total_teachers + total_staff,
            "fee_this_month": fee_this_month,
            "received_this_month": received_this_month,
            "receivable_this_month": receivable_this_month,
            "total_receivable": total_receivable,
            "payout_period_month": last_month.month,
            "payout_period_year": last_month.year,
            "salary_last_month": salary_last_month,
            "paid_last_month": paid_last_month,
            "total_payable": total_payable,
            "today_collection": sum(amount for _, amount in today_payments),
            "today_payments_count": len(today_payments),
            "pending_verification_count": int(pending_count or 0),
            "pending_verification_amount": float(pending_amount or 0),
            "birthdays_today": birthdays_today,
            "messaging_today": messaging_today,
            "receivable_report": self._receivable_report(open_invoices, today.year),
            "student_attendance": self._student_attendance(tenant_id, today, active_students),
            "hr_attendance": self._hr_attendance(tenant_id, today, active_teachers + active_staff),
            "cash_flow": [{"day": d, "cash_in": cash_in[d], "cash_out": cash_out[d]} for d in days],
            "admissions": [{"day": d, "admissions": admitted[d], "withdrawals": withdrawn[d]} for d in days],
        }


def _aware(value: datetime) -> datetime:
    """SQLite returns naive datetimes; treat them as UTC so comparisons work on every backend."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
