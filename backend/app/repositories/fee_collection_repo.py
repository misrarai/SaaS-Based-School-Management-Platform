import uuid
from datetime import date as date_

from sqlalchemy import select

from app.models.fee import Payment, PaymentVerificationStatus
from app.models.fee_collection import (
    FeeConcession,
    FeeHead,
    FeeReceipt,
    FeeStructureItem,
    InvoiceLine,
    LateFeeRule,
)
from app.repositories.base import BaseRepository


class FeeHeadRepository(BaseRepository[FeeHead]):
    model = FeeHead

    def list_heads(self, tenant_id: uuid.UUID, active_only: bool = False) -> list[FeeHead]:
        stmt = select(FeeHead).where(FeeHead.tenant_id == tenant_id)
        if active_only:
            stmt = stmt.where(FeeHead.is_active.is_(True))
        return list(self.db.execute(stmt.order_by(FeeHead.name)).scalars().all())

    def get_by_name(self, tenant_id: uuid.UUID, name: str) -> FeeHead | None:
        stmt = select(FeeHead).where(FeeHead.tenant_id == tenant_id, FeeHead.name == name)
        return self.db.execute(stmt).scalar_one_or_none()


class FeeStructureRepository(BaseRepository[FeeStructureItem]):
    model = FeeStructureItem

    def list_for_class(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID | None = None) -> list[FeeStructureItem]:
        stmt = select(FeeStructureItem).where(FeeStructureItem.tenant_id == tenant_id)
        if class_grade_id is not None:
            stmt = stmt.where(FeeStructureItem.class_grade_id == class_grade_id)
        return list(self.db.execute(stmt).scalars().all())


class InvoiceLineRepository(BaseRepository[InvoiceLine]):
    model = InvoiceLine

    def list_for_invoice(self, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> list[InvoiceLine]:
        stmt = (
            select(InvoiceLine)
            .where(InvoiceLine.tenant_id == tenant_id, InvoiceLine.invoice_id == invoice_id)
            .order_by(InvoiceLine.created_at)
        )
        return list(self.db.execute(stmt).scalars().all())


class FeeConcessionRepository(BaseRepository[FeeConcession]):
    model = FeeConcession

    def list_concessions(self, tenant_id: uuid.UUID, student_id: uuid.UUID | None = None) -> list[FeeConcession]:
        stmt = select(FeeConcession).where(FeeConcession.tenant_id == tenant_id)
        if student_id is not None:
            stmt = stmt.where(FeeConcession.student_id == student_id)
        return list(self.db.execute(stmt.order_by(FeeConcession.created_at.desc())).scalars().all())

    def list_applicable(self, tenant_id: uuid.UUID, student_id: uuid.UUID, on: date_) -> list[FeeConcession]:
        return [
            c
            for c in self.list_concessions(tenant_id, student_id)
            if c.is_active and (c.valid_from is None or c.valid_from <= on) and (c.valid_to is None or c.valid_to >= on)
        ]


class LateFeeRuleRepository(BaseRepository[LateFeeRule]):
    model = LateFeeRule

    def get_for_tenant(self, tenant_id: uuid.UUID) -> LateFeeRule | None:
        stmt = select(LateFeeRule).where(LateFeeRule.tenant_id == tenant_id)
        return self.db.execute(stmt).scalar_one_or_none()


class FeeReceiptRepository(BaseRepository[FeeReceipt]):
    model = FeeReceipt

    def next_receipt_number(self, tenant_id: uuid.UUID) -> str:
        stmt = select(FeeReceipt.receipt_number).where(FeeReceipt.tenant_id == tenant_id)
        max_number = 0
        for (num,) in self.db.execute(stmt).all():
            digits = num.replace("R-", "")
            if digits.isdigit():
                max_number = max(max_number, int(digits))
        return f"R-{max_number + 1:06d}"

    def list_receipts(
        self,
        tenant_id: uuid.UUID,
        date_from: date_ | None = None,
        date_to: date_ | None = None,
        student_ids: list[uuid.UUID] | None = None,
        family_id: uuid.UUID | None = None,
    ) -> list[FeeReceipt]:
        stmt = select(FeeReceipt).where(FeeReceipt.tenant_id == tenant_id)
        if date_from is not None:
            stmt = stmt.where(FeeReceipt.collected_on >= date_from)
        if date_to is not None:
            stmt = stmt.where(FeeReceipt.collected_on <= date_to)
        if family_id is not None:
            stmt = stmt.where(FeeReceipt.family_id == family_id)
        stmt = stmt.order_by(FeeReceipt.collected_on.desc(), FeeReceipt.created_at.desc())
        receipts = list(self.db.execute(stmt).scalars().all())
        if student_ids is not None:
            allowed = set(student_ids)
            receipts = [r for r in receipts if r.student_id in allowed]
        return receipts

    def list_payments(self, tenant_id: uuid.UUID, receipt_id: uuid.UUID) -> list[Payment]:
        stmt = select(Payment).where(Payment.tenant_id == tenant_id, Payment.receipt_id == receipt_id)
        return list(self.db.execute(stmt).scalars().all())

    def list_verified_payments(self, tenant_id: uuid.UUID, invoice_ids: list[uuid.UUID] | None = None) -> list[Payment]:
        stmt = select(Payment).where(
            Payment.tenant_id == tenant_id, Payment.verification_status == PaymentVerificationStatus.VERIFIED
        )
        if invoice_ids is not None:
            stmt = stmt.where(Payment.invoice_id.in_(invoice_ids))
        return list(self.db.execute(stmt).scalars().all())
