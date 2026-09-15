import uuid
from calendar import monthrange
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.fee import InvoiceType, PaymentVerificationStatus
from app.models.payout import PayoutRateType, PayoutStatus, TeacherPayout, TeacherPayoutRate
from app.models.schedule import SessionStatus
from app.repositories.fee_repo import InvoiceRepository, PaymentRepository
from app.repositories.payout_repo import TeacherPayoutRateRepository, TeacherPayoutRepository
from app.repositories.schedule_repo import ClassScheduleRepository, ClassSessionRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.payout import PayoutRateCreate


class PayoutService:
    def __init__(self, db: Session):
        self.db = db
        self.rates = TeacherPayoutRateRepository(db)
        self.payouts = TeacherPayoutRepository(db)
        self.sessions = ClassSessionRepository(db)
        self.schedules = ClassScheduleRepository(db)
        self.student_profiles = StudentProfileRepository(db)
        self.invoices = InvoiceRepository(db)
        self.payments = PaymentRepository(db)
        self.teachers = TeacherProfileRepository(db)

    def set_rate(self, tenant_id: uuid.UUID, payload: PayoutRateCreate) -> TeacherPayoutRate:
        if self.teachers.get_by_id(tenant_id, payload.teacher_id) is None:
            raise NotFoundError("Teacher not found")
        rate = self.rates.create(
            TeacherPayoutRate(
                tenant_id=tenant_id,
                teacher_id=payload.teacher_id,
                subject_id=payload.subject_id,
                rate_type=payload.rate_type,
                rate_value=payload.rate_value,
                effective_from=payload.effective_from,
            )
        )
        self.db.commit()
        self.db.refresh(rate)
        return rate

    def list_rates(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID | None = None) -> list[TeacherPayoutRate]:
        if teacher_id is not None:
            return self.rates.list_active_for_teacher(tenant_id, teacher_id)
        return self.rates.list(tenant_id)

    def _current_rate(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> TeacherPayoutRate | None:
        active = self.rates.list_active_for_teacher(tenant_id, teacher_id)
        return active[0] if active else None

    def _month_bounds(self, period_month: int, period_year: int) -> tuple[date, date]:
        last_day = monthrange(period_year, period_month)[1]
        return date(period_year, period_month, 1), date(period_year, period_month, last_day)

    def _revenue_share_amount(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID, period_month: int, period_year: int, rate_percent: float
    ) -> float:
        """Approximation: rate% of verified tuition payments (for the period) made by students in
        sections this teacher is scheduled to teach — each student counted once even if the teacher
        teaches them more than one subject. Schools splitting a section across multiple
        subject-teachers should prefer PER_SESSION rates instead, since this pool is shared across
        every teacher scheduled for that section."""
        schedules = [s for s in self.schedules.list(tenant_id) if s.teacher_id == teacher_id]
        section_ids = {s.section_id for s in schedules}
        student_ids: set[uuid.UUID] = set()
        for section_id in section_ids:
            for profile, _user in self.student_profiles.list_with_users(tenant_id, section_id=section_id, status="active"):
                student_ids.add(profile.id)
        if not student_ids:
            return 0.0

        relevant_invoices = [
            inv
            for inv in self.invoices.list_invoices(tenant_id)
            if inv.student_id in student_ids
            and inv.invoice_type == InvoiceType.TUITION
            and inv.period_month == period_month
            and inv.period_year == period_year
        ]
        total_verified = 0.0
        for invoice in relevant_invoices:
            payments = self.payments.list_for_invoice(tenant_id, invoice.id)
            total_verified += sum(
                float(p.amount) for p in payments if p.verification_status == PaymentVerificationStatus.VERIFIED
            )
        return round(total_verified * rate_percent / 100, 2)

    def generate_payout(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID, period_month: int, period_year: int
    ) -> TeacherPayout:
        if self.teachers.get_by_id(tenant_id, teacher_id) is None:
            raise NotFoundError("Teacher not found")
        rate = self._current_rate(tenant_id, teacher_id)
        if rate is None:
            raise NotFoundError("No active payout rate set for this teacher")

        date_from, date_to = self._month_bounds(period_month, period_year)
        sessions = self.sessions.list_sessions(tenant_id, teacher_id=teacher_id, date_from=date_from, date_to=date_to)
        completed_sessions = [s for s in sessions if s.status == SessionStatus.COMPLETED]

        if rate.rate_type == PayoutRateType.PER_SESSION:
            amount = float(rate.rate_value) * len(completed_sessions)
        else:
            amount = self._revenue_share_amount(tenant_id, teacher_id, period_month, period_year, float(rate.rate_value))

        existing = self.payouts.get_for_teacher_period(tenant_id, teacher_id, period_month, period_year)
        if existing is not None:
            if existing.status != PayoutStatus.DRAFT:
                raise ConflictError("Cannot regenerate a payout that has already been approved or paid")
            existing.sessions_delivered = len(completed_sessions)
            existing.calculated_amount = amount
            payout = existing
        else:
            payout = self.payouts.create(
                TeacherPayout(
                    tenant_id=tenant_id,
                    teacher_id=teacher_id,
                    period_month=period_month,
                    period_year=period_year,
                    sessions_delivered=len(completed_sessions),
                    calculated_amount=amount,
                )
            )
        self.db.commit()
        self.db.refresh(payout)
        return payout

    def bulk_generate_payouts(self, tenant_id: uuid.UUID, period_month: int, period_year: int) -> list[TeacherPayout]:
        teacher_ids = {r.teacher_id for r in self.rates.list(tenant_id) if r.is_active}
        results = []
        for teacher_id in teacher_ids:
            existing = self.payouts.get_for_teacher_period(tenant_id, teacher_id, period_month, period_year)
            if existing is not None and existing.status != PayoutStatus.DRAFT:
                continue  # skip teachers whose payout for this period is already approved/paid
            results.append(self.generate_payout(tenant_id, teacher_id, period_month, period_year))
        return results

    def list_payouts(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID | None = None) -> list[TeacherPayout]:
        return self.payouts.list_payouts(tenant_id, teacher_id=teacher_id)

    def get_payout_or_404(self, tenant_id: uuid.UUID, payout_id: uuid.UUID) -> TeacherPayout:
        payout = self.payouts.get_by_id(tenant_id, payout_id)
        if payout is None:
            raise NotFoundError("Payout not found")
        return payout

    def mark_approved(self, tenant_id: uuid.UUID, payout_id: uuid.UUID, approver_id: uuid.UUID) -> TeacherPayout:
        payout = self.get_payout_or_404(tenant_id, payout_id)
        payout.status = PayoutStatus.APPROVED
        payout.approved_by_user_id = approver_id
        self.db.commit()
        self.db.refresh(payout)
        return payout

    def mark_paid(self, tenant_id: uuid.UUID, payout_id: uuid.UUID) -> TeacherPayout:
        payout = self.get_payout_or_404(tenant_id, payout_id)
        payout.status = PayoutStatus.PAID
        payout.paid_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(payout)
        return payout
