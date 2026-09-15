import uuid

from sqlalchemy import select

from app.models.fee import FeePlan, Invoice, InvoiceStatus, InvoiceType, Payment, PaymentVerificationStatus
from app.repositories.base import BaseRepository


class FeePlanRepository(BaseRepository[FeePlan]):
    model = FeePlan

    def get_for_class_year(
        self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, academic_year: str
    ) -> FeePlan | None:
        stmt = select(FeePlan).where(
            FeePlan.tenant_id == tenant_id,
            FeePlan.class_grade_id == class_grade_id,
            FeePlan.academic_year == academic_year,
        )
        return self.db.execute(stmt).scalar_one_or_none()


class InvoiceRepository(BaseRepository[Invoice]):
    model = Invoice

    def next_invoice_number(self, tenant_id: uuid.UUID) -> str:
        invoices = self.list(tenant_id)
        max_number = 0
        for inv in invoices:
            if inv.invoice_number.isdigit():
                max_number = max(max_number, int(inv.invoice_number))
        return str(max_number + 1)

    def get_for_student_period(
        self,
        tenant_id: uuid.UUID,
        student_id: uuid.UUID,
        invoice_type: InvoiceType,
        period_month: int | None,
        period_year: int | None,
    ) -> Invoice | None:
        stmt = select(Invoice).where(
            Invoice.tenant_id == tenant_id,
            Invoice.student_id == student_id,
            Invoice.invoice_type == invoice_type,
            Invoice.period_month == period_month,
            Invoice.period_year == period_year,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_invoices(
        self,
        tenant_id: uuid.UUID,
        student_id: uuid.UUID | None = None,
        student_ids: list[uuid.UUID] | None = None,
        class_grade_id: uuid.UUID | None = None,
        status: InvoiceStatus | None = None,
    ) -> list[Invoice]:
        stmt = select(Invoice).where(Invoice.tenant_id == tenant_id)
        if student_id is not None:
            stmt = stmt.where(Invoice.student_id == student_id)
        if student_ids is not None:
            stmt = stmt.where(Invoice.student_id.in_(student_ids))
        if class_grade_id is not None:
            stmt = stmt.where(Invoice.class_grade_id == class_grade_id)
        if status is not None:
            stmt = stmt.where(Invoice.status == status)
        stmt = stmt.order_by(Invoice.due_date.desc())
        return list(self.db.execute(stmt).scalars().all())


class PaymentRepository(BaseRepository[Payment]):
    model = Payment

    def list_for_invoice(self, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> list[Payment]:
        stmt = select(Payment).where(Payment.tenant_id == tenant_id, Payment.invoice_id == invoice_id)
        return list(self.db.execute(stmt).scalars().all())

    def list_pending(self, tenant_id: uuid.UUID) -> list[Payment]:
        stmt = (
            select(Payment)
            .where(Payment.tenant_id == tenant_id, Payment.verification_status == PaymentVerificationStatus.PENDING)
            .order_by(Payment.submitted_at)
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_all(self, tenant_id: uuid.UUID, status: PaymentVerificationStatus | None = None) -> list[Payment]:
        stmt = select(Payment).where(Payment.tenant_id == tenant_id)
        if status is not None:
            stmt = stmt.where(Payment.verification_status == status)
        stmt = stmt.order_by(Payment.submitted_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def sum_verified_for_invoice(self, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> float:
        payments = self.list_for_invoice(tenant_id, invoice_id)
        return sum(float(p.amount) for p in payments if p.verification_status == PaymentVerificationStatus.VERIFIED)
