import uuid
from datetime import date as date_
from datetime import datetime, timedelta, timezone

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.models.fee import (
    FeePlan,
    Invoice,
    InvoiceStatus,
    InvoiceType,
    Payment,
    PaymentMethod,
    PaymentVerificationStatus,
)
from app.models.payment_gateway import GatewayTransaction, GatewayTransactionStatus, PaymentGateway
from app.models.student_admission_detail import StudentAdmissionDetail
from app.repositories.academic_repo import ClassGradeRepository
from app.models.fee_collection import LateFeeRule
from app.repositories.fee_collection_repo import LateFeeRuleRepository
from app.repositories.fee_repo import FeePlanRepository, InvoiceRepository, PaymentRepository
from app.repositories.payment_gateway_repo import GatewayTransactionRepository
from app.repositories.student_admission_repo import StudentAdmissionDetailRepository
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.fee import (
    BulkGenerateInvoicesRequest,
    BulkGenerateInvoicesResult,
    FeePlanCreate,
    FeePlanUpdate,
    FeeReportSummary,
    GenerateInvoicesRequest,
    InitiateGatewayPaymentResponse,
    InvoiceCreate,
    PaymentDetailOut,
    PaymentOut,
    SubscriptionEntry,
)
from app.services.jazzcash_service import JazzCashService
from app.services.upload_service import save_receipt

# PKR credited to a referring family's own child when a new student they referred enrolls —
# see FeeService.apply_referral_credit.
REFERRAL_REWARD_AMOUNT = 500.0


def apply_late_fee(invoice: Invoice, rule: LateFeeRule | None, on_date: date_) -> float:
    """Charges the tenant's fixed late fee on an unpaid invoice once it is more than
    rule.grace_days past due. Folded into net_amount (and recorded in late_fee_amount) so every
    "is it fully paid?" check keeps working unchanged. Charged at most once per invoice.
    Returns the fine applied (0 when none). Does not commit."""
    if rule is None or not rule.is_active or float(rule.amount or 0) <= 0:
        return 0.0
    if float(invoice.late_fee_amount or 0) > 0:
        return 0.0
    if invoice.status in (InvoiceStatus.PAID, InvoiceStatus.WAIVED):
        return 0.0
    if on_date <= invoice.due_date + timedelta(days=rule.grace_days or 0):
        return 0.0
    fee = float(rule.amount)
    invoice.late_fee_amount = fee
    invoice.net_amount = float(invoice.net_amount) + fee
    return fee


class FeeService:
    def __init__(self, db: Session):
        self.db = db
        self.fee_plans = FeePlanRepository(db)
        self.invoices = InvoiceRepository(db)
        self.payments = PaymentRepository(db)
        self.class_grades = ClassGradeRepository(db)
        self.student_profiles = StudentProfileRepository(db)
        self.admission_details = StudentAdmissionDetailRepository(db)
        self.gateway_transactions = GatewayTransactionRepository(db)
        self.jazzcash = JazzCashService()

    def set_fee_plan(self, tenant_id: uuid.UUID, payload: FeePlanCreate) -> FeePlan:
        if self.class_grades.get_by_id(tenant_id, payload.class_grade_id) is None:
            raise NotFoundError("Class not found")
        if self.fee_plans.get_for_class_year(tenant_id, payload.class_grade_id, payload.academic_year) is not None:
            raise ConflictError("A fee plan already exists for this class and academic year")
        plan = self.fee_plans.create(
            FeePlan(
                tenant_id=tenant_id,
                class_grade_id=payload.class_grade_id,
                academic_year=payload.academic_year,
                monthly_amount=payload.monthly_amount,
                name=payload.name,
            )
        )
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def list_fee_plans(self, tenant_id: uuid.UUID) -> list[FeePlan]:
        return self.fee_plans.list(tenant_id)

    def update_fee_plan(self, tenant_id: uuid.UUID, plan_id: uuid.UUID, payload: FeePlanUpdate) -> FeePlan:
        plan = self.fee_plans.get_by_id(tenant_id, plan_id)
        if plan is None:
            raise NotFoundError("Fee plan not found")
        if payload.monthly_amount is not None:
            plan.monthly_amount = payload.monthly_amount
        if payload.name is not None:
            plan.name = payload.name
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def _student_discount(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> float:
        detail = self.admission_details.get_by_student_id(tenant_id, student_id)
        if detail is None:
            return 0.0
        return float(detail.discount_amount or 0) + float(detail.referral_discount_amount or 0)

    def _build_invoice(
        self,
        tenant_id: uuid.UUID,
        student_id: uuid.UUID,
        class_grade_id: uuid.UUID,
        invoice_type: InvoiceType,
        amount_due: float,
        due_date: date_,
        period_month: int | None = None,
        period_year: int | None = None,
        notes: str | None = None,
    ) -> Invoice:
        discount = self._student_discount(tenant_id, student_id)
        net_amount = max(0.0, amount_due - discount)
        return self.invoices.create(
            Invoice(
                tenant_id=tenant_id,
                student_id=student_id,
                class_grade_id=class_grade_id,
                invoice_type=invoice_type,
                invoice_number=self.invoices.next_invoice_number(tenant_id),
                period_month=period_month,
                period_year=period_year,
                amount_due=amount_due,
                discount_amount=discount,
                net_amount=net_amount,
                due_date=due_date,
                notes=notes,
            )
        )

    def create_invoice(self, tenant_id: uuid.UUID, payload: InvoiceCreate) -> Invoice:
        student = self.student_profiles.get_by_id(tenant_id, payload.student_id)
        if student is None:
            raise NotFoundError("Student not found")
        if student.class_grade_id is None:
            raise ConflictError("Student is not assigned to a class")
        invoice = self._build_invoice(
            tenant_id,
            payload.student_id,
            student.class_grade_id,
            payload.invoice_type,
            payload.amount_due,
            payload.due_date,
            notes=payload.notes,
        )
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def generate_monthly_invoices(self, tenant_id: uuid.UUID, payload: GenerateInvoicesRequest) -> list[Invoice]:
        class_grade = self.class_grades.get_by_id(tenant_id, payload.class_grade_id)
        if class_grade is None:
            raise NotFoundError("Class not found")
        plan = self.fee_plans.get_for_class_year(tenant_id, payload.class_grade_id, class_grade.academic_year)
        if plan is None:
            raise NotFoundError("No fee plan set for this class — set one before generating invoices")

        students = self.student_profiles.list_with_users(
            tenant_id, class_grade_id=payload.class_grade_id, status="active"
        )
        created: list[Invoice] = []
        for profile, _user in students:
            existing = self.invoices.get_for_student_period(
                tenant_id, profile.id, InvoiceType.TUITION, payload.period_month, payload.period_year
            )
            if existing is not None:
                continue
            invoice = self._build_invoice(
                tenant_id,
                profile.id,
                payload.class_grade_id,
                InvoiceType.TUITION,
                float(plan.monthly_amount),
                payload.due_date,
                period_month=payload.period_month,
                period_year=payload.period_year,
            )
            created.append(invoice)
        self.db.commit()
        for inv in created:
            self.db.refresh(inv)
        return created

    def bulk_generate_monthly_invoices(
        self, tenant_id: uuid.UUID, payload: BulkGenerateInvoicesRequest
    ) -> BulkGenerateInvoicesResult:
        """Runs generate_monthly_invoices across every requested class in one call (or every
        class that has a fee plan, when no classes are given — the "generate this month's
        invoices for the whole academy" button). A class with no fee plan set is skipped
        rather than failing the whole batch, since that's an expected, recoverable gap the
        admin can fix and re-run, not an error in the request itself."""
        class_grade_ids = payload.class_grade_ids
        if not class_grade_ids:
            class_grade_ids = [p.class_grade_id for p in self.fee_plans.list(tenant_id)]

        created: list[Invoice] = []
        skipped: list[str] = []
        for class_grade_id in class_grade_ids:
            class_grade = self.class_grades.get_by_id(tenant_id, class_grade_id)
            if class_grade is None:
                skipped.append(f"{class_grade_id}: class not found")
                continue
            plan = self.fee_plans.get_for_class_year(tenant_id, class_grade_id, class_grade.academic_year)
            if plan is None:
                skipped.append(f"{class_grade.name}: no fee plan set")
                continue
            invoices = self.generate_monthly_invoices(
                tenant_id,
                GenerateInvoicesRequest(
                    class_grade_id=class_grade_id,
                    period_month=payload.period_month,
                    period_year=payload.period_year,
                    due_date=payload.due_date,
                ),
            )
            created.extend(invoices)

        return BulkGenerateInvoicesResult(
            invoices_created=len(created), classes_processed=len(class_grade_ids) - len(skipped), skipped=skipped
        )

    def mark_overdue_invoices(self, tenant_id: uuid.UUID) -> int:
        """Flips PENDING invoices whose due_date has passed to OVERDUE. Idempotent — safe to
        call as often as needed (the daily scheduler job, or an admin's manual "refresh")."""
        today = date_.today()
        pending = self.invoices.list_invoices(tenant_id, status=InvoiceStatus.PENDING)
        overdue = [inv for inv in pending if inv.due_date < today]
        for inv in overdue:
            inv.status = InvoiceStatus.OVERDUE
        # Late-fee fine (per-tenant rule) on every overdue invoice not yet fined — including
        # ones flipped on an earlier run that were still inside the grace period then.
        rule = LateFeeRuleRepository(self.db).get_for_tenant(tenant_id)
        fined = 0.0
        if rule is not None:
            # (autoflush is off, so the just-flipped rows aren't in the OVERDUE query yet)
            already = self.invoices.list_invoices(tenant_id, status=InvoiceStatus.OVERDUE)
            for inv in {i.id: i for i in already + overdue}.values():
                fined += apply_late_fee(inv, rule, today)
        if overdue or fined:
            self.db.commit()
        return len(overdue)

    def apply_referral_credit(
        self, tenant_id: uuid.UUID, referring_family_id: uuid.UUID, reward: float = REFERRAL_REWARD_AMOUNT
    ) -> None:
        """Called once, right after a new student is admitted with `referred_by_family_id`
        set, to reward the REFERRING family — distinct from `referral_discount_amount` on the
        new student's own row, which is a discount for the student being referred, not a
        reward for whoever referred them. Credits the referring family's first active child by
        bumping their `referral_discount_amount` (additive, so repeat referrals stack), which
        `_student_discount` already reads at invoice-generation time — no new ledger table
        needed. If the family has more than one active child, the whole reward lands on
        just one of them (documented simplification, same spirit as the payout module's
        revenue-share approximation) rather than splitting it.
        Does not commit — caller controls the transaction boundary."""
        siblings = self.student_profiles.list_with_users(tenant_id, family_id=referring_family_id, status="active")
        if not siblings:
            return
        profile, _user = siblings[0]
        detail = self.admission_details.get_by_student_id(tenant_id, profile.id)
        if detail is None:
            self.admission_details.create(
                StudentAdmissionDetail(tenant_id=tenant_id, student_id=profile.id, referral_discount_amount=reward)
            )
        else:
            detail.referral_discount_amount = float(detail.referral_discount_amount or 0) + reward

    def sync_paid_state(self, tenant_id: uuid.UUID, invoice: Invoice) -> None:
        """Recomputes invoice.amount_paid from its VERIFIED payments and flips it to PAID once
        fully covered (net_amount includes any late fee). Does not commit."""
        verified_total = self.payments.sum_verified_for_invoice(tenant_id, invoice.id)
        invoice.amount_paid = verified_total
        if verified_total >= float(invoice.net_amount) - 0.005:
            invoice.status = InvoiceStatus.PAID

    def get_invoice_or_404(self, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> Invoice:
        invoice = self.invoices.get_by_id(tenant_id, invoice_id)
        if invoice is None:
            raise NotFoundError("Invoice not found")
        return invoice

    def list_invoices(
        self,
        tenant_id: uuid.UUID,
        student_id: uuid.UUID | None = None,
        student_ids: list[uuid.UUID] | None = None,
        class_grade_id: uuid.UUID | None = None,
        status: InvoiceStatus | None = None,
    ) -> list[Invoice]:
        return self.invoices.list_invoices(
            tenant_id, student_id=student_id, student_ids=student_ids, class_grade_id=class_grade_id, status=status
        )

    def submit_payment(
        self,
        tenant_id: uuid.UUID,
        invoice_id: uuid.UUID,
        submitted_by_user_id: uuid.UUID,
        amount: float,
        payment_method: PaymentMethod,
        reference_note: str | None,
        receipt: UploadFile | None,
    ) -> Payment:
        if amount is None or amount <= 0:
            raise DomainError("Payment amount must be greater than zero")
        invoice = self.get_invoice_or_404(tenant_id, invoice_id)
        if invoice.status in (InvoiceStatus.PAID, InvoiceStatus.WAIVED):
            raise ConflictError(f"This invoice is already {invoice.status.value}")
        receipt_url = save_receipt(receipt) if receipt is not None else None
        payment = self.payments.create(
            Payment(
                tenant_id=tenant_id,
                invoice_id=invoice_id,
                amount=amount,
                payment_method=payment_method,
                reference_note=reference_note,
                receipt_image_url=receipt_url,
                submitted_by_user_id=submitted_by_user_id,
                submitted_at=datetime.now(timezone.utc),
            )
        )
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def list_pending_payments(self, tenant_id: uuid.UUID) -> list[Payment]:
        return self.payments.list_pending(tenant_id)

    def _enrich_payment(self, tenant_id: uuid.UUID, payment: Payment) -> PaymentDetailOut | None:
        invoice = self.invoices.get_by_id(tenant_id, payment.invoice_id)
        if invoice is None:
            return None
        found = self.student_profiles.get_with_user(tenant_id, invoice.student_id)
        student_name = found[1].full_name if found is not None else "Unknown student"
        return PaymentDetailOut(
            **PaymentOut.model_validate(payment).model_dump(),
            student_id=invoice.student_id,
            student_name=student_name,
            invoice_number=invoice.invoice_number,
            invoice_type=invoice.invoice_type,
        )

    def list_pending_payments_detailed(self, tenant_id: uuid.UUID) -> list[PaymentDetailOut]:
        return [d for p in self.payments.list_pending(tenant_id) if (d := self._enrich_payment(tenant_id, p)) is not None]

    def list_payments_detailed(
        self, tenant_id: uuid.UUID, status: PaymentVerificationStatus | None = None
    ) -> list[PaymentDetailOut]:
        return [d for p in self.payments.list_all(tenant_id, status) if (d := self._enrich_payment(tenant_id, p)) is not None]

    def list_subscriptions(self, tenant_id: uuid.UUID) -> list[SubscriptionEntry]:
        students = self.student_profiles.list_with_users(tenant_id, status="active")
        out: list[SubscriptionEntry] = []
        for profile, user in students:
            if profile.class_grade_id is None:
                continue
            class_grade = self.class_grades.get_by_id(tenant_id, profile.class_grade_id)
            plan = (
                self.fee_plans.get_for_class_year(tenant_id, profile.class_grade_id, class_grade.academic_year)
                if class_grade is not None
                else None
            )
            invoices = self.invoices.list_invoices(tenant_id, student_id=profile.id)
            current = invoices[0] if invoices else None
            out.append(
                SubscriptionEntry(
                    student_id=profile.id,
                    student_name=user.full_name,
                    class_grade_id=profile.class_grade_id,
                    class_grade_name=class_grade.name if class_grade is not None else "",
                    monthly_amount=float(plan.monthly_amount) if plan is not None else None,
                    current_status=current.status if current is not None else None,
                    current_invoice_id=current.id if current is not None else None,
                )
            )
        return out

    def get_report_summary(self, tenant_id: uuid.UUID, period_month: int, period_year: int) -> FeeReportSummary:
        period_invoices = [
            inv
            for inv in self.invoices.list_invoices(tenant_id)
            if inv.period_month == period_month and inv.period_year == period_year
        ]
        period_invoice_ids = {inv.id for inv in period_invoices}
        total_pending = sum(
            float(inv.net_amount) for inv in period_invoices if inv.status in (InvoiceStatus.PENDING, InvoiceStatus.OVERDUE)
        )
        total_overdue = sum(float(inv.net_amount) for inv in period_invoices if inv.status == InvoiceStatus.OVERDUE)

        # Collected-for-period is tied to the invoice's own period, not to whatever calendar
        # month the admin happened to click "verify" in.
        verified_payments = [
            p
            for p in self.payments.list_all(tenant_id, PaymentVerificationStatus.VERIFIED)
            if p.invoice_id in period_invoice_ids
        ]
        total_collected = sum(float(p.amount) for p in verified_payments)
        by_method: dict[str, float] = {}
        for p in verified_payments:
            by_method[p.payment_method.value] = by_method.get(p.payment_method.value, 0.0) + float(p.amount)

        return FeeReportSummary(
            period_month=period_month,
            period_year=period_year,
            total_collected=total_collected,
            total_pending=total_pending,
            total_overdue=total_overdue,
            by_method=by_method,
        )

    def verify_payment(
        self,
        tenant_id: uuid.UUID,
        payment_id: uuid.UUID,
        verifier_id: uuid.UUID,
        approve: bool,
        rejection_reason: str | None,
    ) -> Payment:
        payment = self.payments.get_by_id(tenant_id, payment_id)
        if payment is None:
            raise NotFoundError("Payment not found")
        if payment.verification_status != PaymentVerificationStatus.PENDING:
            raise ConflictError(f"This payment has already been {payment.verification_status.value}")
        payment.verified_by_user_id = verifier_id
        payment.verified_at = datetime.now(timezone.utc)
        if approve:
            payment.verification_status = PaymentVerificationStatus.VERIFIED
            payment.rejection_reason = None
            invoice = self.get_invoice_or_404(tenant_id, payment.invoice_id)
            self.sync_paid_state(tenant_id, invoice)
        else:
            payment.verification_status = PaymentVerificationStatus.REJECTED
            payment.rejection_reason = rejection_reason
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def initiate_jazzcash_payment(
        self, tenant_id: uuid.UUID, invoice_id: uuid.UUID, initiated_by_user_id: uuid.UUID
    ) -> InitiateGatewayPaymentResponse:
        """Starts a JazzCash hosted-checkout attempt: records a GatewayTransaction row up front
        (before the outcome is known) and returns the signed pp_* fields the frontend renders as
        a hidden auto-submitting form POSTed to JazzCash's checkout page."""
        invoice = self.get_invoice_or_404(tenant_id, invoice_id)
        if invoice.status in (InvoiceStatus.PAID, InvoiceStatus.WAIVED):
            raise ConflictError("This invoice is already paid")
        # Only the outstanding balance is charged, so a partially-paid invoice isn't overpaid.
        balance = round(float(invoice.net_amount) - float(invoice.amount_paid or 0), 2)
        if balance <= 0:
            raise ConflictError("This invoice has no outstanding balance")
        if not self.jazzcash.is_configured():
            raise ConflictError("JazzCash is not configured on this server yet")

        txn_ref_no = f"T{uuid.uuid4().hex[:20].upper()}"
        self.gateway_transactions.create(
            GatewayTransaction(
                tenant_id=tenant_id,
                invoice_id=invoice_id,
                initiated_by_user_id=initiated_by_user_id,
                gateway=PaymentGateway.JAZZCASH,
                txn_ref_no=txn_ref_no,
                amount=balance,
            )
        )
        self.db.commit()

        fields = self.jazzcash.build_checkout_fields(
            txn_ref_no=txn_ref_no,
            amount_pkr=balance,
            bill_reference=invoice.invoice_number,
            description=f"Invoice {invoice.invoice_number}",
        )
        return InitiateGatewayPaymentResponse(
            checkout_url=settings.JAZZCASH_CHECKOUT_URL, fields=fields, txn_ref_no=txn_ref_no
        )

    def handle_jazzcash_callback(self, fields: dict[str, str]) -> GatewayTransaction:
        """Processes JazzCash's callback POST. Verifies the secure hash before trusting anything
        else in it, is idempotent against duplicate/retried callbacks (a transaction is only ever
        processed once — its first resolution wins), and on success creates an already-VERIFIED
        Payment (a gateway confirmation needs no separate admin review, unlike an uploaded
        receipt screenshot) and marks the invoice PAID once fully covered."""
        result = self.jazzcash.parse_callback(fields)
        if result.txn_ref_no is None:
            raise NotFoundError("Callback is missing a transaction reference")

        txn = self.gateway_transactions.get_by_txn_ref_no(result.txn_ref_no)
        if txn is None:
            raise NotFoundError("Unknown transaction reference")

        if txn.status != GatewayTransactionStatus.INITIATED:
            return txn  # already resolved — ignore a duplicate/retried callback

        txn.gateway_response_code = result.response_code
        txn.gateway_response_message = result.response_message
        txn.gateway_txn_id = result.retrieval_reference_no
        txn.completed_at = datetime.now(timezone.utc)

        if not result.hash_valid:
            txn.status = GatewayTransactionStatus.FAILED
            txn.gateway_response_message = "Secure hash verification failed"
            self.db.commit()
            self.db.refresh(txn)
            return txn

        if result.success:
            payment = self.payments.create(
                Payment(
                    tenant_id=txn.tenant_id,
                    invoice_id=txn.invoice_id,
                    amount=txn.amount,
                    payment_method=PaymentMethod.JAZZCASH,
                    reference_note=f"JazzCash RRN {result.retrieval_reference_no}" if result.retrieval_reference_no else None,
                    submitted_by_user_id=txn.initiated_by_user_id,
                    submitted_at=datetime.now(timezone.utc),
                    verification_status=PaymentVerificationStatus.VERIFIED,
                    verified_at=datetime.now(timezone.utc),
                )
            )
            invoice = self.get_invoice_or_404(txn.tenant_id, txn.invoice_id)
            self.sync_paid_state(txn.tenant_id, invoice)
            txn.payment_id = payment.id
            txn.status = GatewayTransactionStatus.COMPLETED
        else:
            txn.status = GatewayTransactionStatus.FAILED

        self.db.commit()
        self.db.refresh(txn)
        return txn

    def list_gateway_transactions(self, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> list[GatewayTransaction]:
        return self.gateway_transactions.list_for_invoice(tenant_id, invoice_id)
