"""Fee heads & structures, itemised vouchers, concessions, late fees, the cash-desk collection
counter, defaulters, family ledgers and collection reports. Builds on FeeService/fee models."""

import io
import uuid
from collections import defaultdict
from datetime import date as date_
from datetime import datetime, time, timedelta, timezone

from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, DomainError, ForbiddenError, NotFoundError
from app.core.fee_collection_pdf import render_family_ledger, render_fee_vouchers, render_payment_receipt
from app.models.family import Family
from app.models.fee import Invoice, InvoiceStatus, InvoiceType, Payment, PaymentVerificationStatus
from app.models.fee_collection import (
    ConcessionType,
    FeeConcession,
    FeeFrequency,
    FeeHead,
    FeeReceipt,
    FeeStructureItem,
    InvoiceLine,
    LateFeeRule,
)
from app.models.tenant import Tenant
from app.models.user import StudentProfile, User
from app.repositories.academic_repo import ClassGradeRepository
from app.repositories.family_repo import FamilyRepository
from app.repositories.fee_collection_repo import (
    FeeConcessionRepository,
    FeeHeadRepository,
    FeeReceiptRepository,
    FeeStructureRepository,
    InvoiceLineRepository,
    LateFeeRuleRepository,
)
from app.repositories.fee_repo import InvoiceRepository, PaymentRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.user_repo import UserRepository
from app.schemas.fee_collection import (
    ClassCollectionRow,
    ClassCollectionSummary,
    CollectionPaymentRow,
    CollectRequest,
    ConcessionCreate,
    ConcessionOut,
    ConcessionUpdate,
    CounterAccountOut,
    CounterSearchResult,
    CounterStudentOut,
    DailyCollectionDay,
    DailyCollectionReport,
    DefaulterRow,
    FeeHeadCreate,
    FeeHeadUpdate,
    FeeStructureItemOut,
    FeeStructureOut,
    FeeStructureSet,
    GenerateStructuredInvoicesRequest,
    GenerateStructuredInvoicesResult,
    InvoiceSummaryOut,
    ItemizedInvoiceCreate,
    LateFeeRuleIn,
    LateFeeRuleOut,
    LedgerEntry,
    LedgerOut,
    ReceiptAllocationOut,
    ReceiptOut,
    ReminderResult,
)
from app.services.fee_service import FeeService, apply_late_fee

OPEN_STATUSES = (InvoiceStatus.PENDING, InvoiceStatus.OVERDUE)
MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

DEFAULT_HEADS: list[tuple[str, str, FeeFrequency]] = [
    ("Tuition Fee", "TUI", FeeFrequency.MONTHLY),
    ("Admission Fee", "ADM", FeeFrequency.ONE_TIME),
    ("Exam Fee", "EXM", FeeFrequency.PER_TERM),
    ("Transport Fee", "TRN", FeeFrequency.MONTHLY),
    ("Lab Fee", "LAB", FeeFrequency.ANNUAL),
    ("Annual Charges", "ANN", FeeFrequency.ANNUAL),
    ("Fine", "FIN", FeeFrequency.ONE_TIME),
]


def invoice_paid(inv: Invoice) -> float:
    if inv.status == InvoiceStatus.PAID:
        return max(float(inv.net_amount), float(inv.amount_paid or 0))
    return float(inv.amount_paid or 0)


def invoice_balance(inv: Invoice) -> float:
    if inv.status in (InvoiceStatus.PAID, InvoiceStatus.WAIVED):
        return 0.0
    return round(max(0.0, float(inv.net_amount) - float(inv.amount_paid or 0)), 2)


def period_label(month: int | None, year: int | None) -> str | None:
    if month and year:
        return f"{MONTH_ABBR[month]} {year}"
    return None


def months_between(start: date_, end: date_) -> int:
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(0, months)


class FeeCollectionService:
    def __init__(self, db: Session):
        self.db = db
        self.heads = FeeHeadRepository(db)
        self.structure = FeeStructureRepository(db)
        self.lines = InvoiceLineRepository(db)
        self.concessions = FeeConcessionRepository(db)
        self.late_rules = LateFeeRuleRepository(db)
        self.receipts = FeeReceiptRepository(db)
        self.invoices = InvoiceRepository(db)
        self.payments = PaymentRepository(db)
        self.students = StudentProfileRepository(db)
        self.classes = ClassGradeRepository(db)
        self.families = FamilyRepository(db)
        self.users = UserRepository(db)
        self.fee = FeeService(db)
        self._class_cache: dict[uuid.UUID, str] = {}
        self._student_cache: dict[uuid.UUID, tuple[StudentProfile, User] | None] = {}

    # ------------------------------------------------------------------ small lookups

    def _tenant_name(self, tenant_id: uuid.UUID) -> str:
        tenant = self.db.get(Tenant, tenant_id)
        return tenant.name if tenant is not None else "School"

    def _class_name(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID | None) -> str | None:
        if class_grade_id is None:
            return None
        if class_grade_id not in self._class_cache:
            cg = self.classes.get_by_id(tenant_id, class_grade_id)
            self._class_cache[class_grade_id] = cg.name if cg is not None else ""
        return self._class_cache[class_grade_id]

    def _student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> tuple[StudentProfile, User] | None:
        if student_id not in self._student_cache:
            self._student_cache[student_id] = self.students.get_with_user(tenant_id, student_id)
        return self._student_cache[student_id]

    def _student_name(self, tenant_id: uuid.UUID, student_id: uuid.UUID | None) -> str:
        if student_id is None:
            return ""
        found = self._student(tenant_id, student_id)
        return found[1].full_name if found is not None else "Unknown student"

    def _head_or_404(self, tenant_id: uuid.UUID, head_id: uuid.UUID) -> FeeHead:
        head = self.heads.get_by_id(tenant_id, head_id)
        if head is None:
            raise NotFoundError("Fee head not found")
        return head

    def summarize(self, tenant_id: uuid.UUID, inv: Invoice) -> InvoiceSummaryOut:
        found = self._student(tenant_id, inv.student_id)
        return InvoiceSummaryOut(
            id=inv.id,
            invoice_number=inv.invoice_number,
            student_id=inv.student_id,
            student_name=found[1].full_name if found else "Unknown student",
            admission_number=found[0].admission_number if found else None,
            class_grade_id=inv.class_grade_id,
            class_grade_name=self._class_name(tenant_id, inv.class_grade_id) or "",
            invoice_type=inv.invoice_type,
            period_month=inv.period_month,
            period_year=inv.period_year,
            due_date=inv.due_date,
            status=inv.status,
            amount_due=float(inv.amount_due),
            discount_amount=float(inv.discount_amount or 0),
            late_fee_amount=float(inv.late_fee_amount or 0),
            net_amount=float(inv.net_amount),
            amount_paid=invoice_paid(inv),
            balance=invoice_balance(inv),
        )

    # ------------------------------------------------------------------ fee heads

    def list_heads(self, tenant_id: uuid.UUID, active_only: bool = False) -> list[FeeHead]:
        return self.heads.list_heads(tenant_id, active_only)

    def create_head(self, tenant_id: uuid.UUID, payload: FeeHeadCreate) -> FeeHead:
        if self.heads.get_by_name(tenant_id, payload.name.strip()) is not None:
            raise ConflictError("A fee head with this name already exists")
        head = self.heads.create(
            FeeHead(
                tenant_id=tenant_id,
                name=payload.name.strip(),
                code=payload.code,
                default_frequency=payload.default_frequency,
                description=payload.description,
                is_active=True,
            )
        )
        self.db.commit()
        self.db.refresh(head)
        return head

    def update_head(self, tenant_id: uuid.UUID, head_id: uuid.UUID, payload: FeeHeadUpdate) -> FeeHead:
        head = self._head_or_404(tenant_id, head_id)
        data = payload.model_dump(exclude_unset=True)
        if "name" in data and data["name"] is not None:
            name = data["name"].strip()
            other = self.heads.get_by_name(tenant_id, name)
            if other is not None and other.id != head.id:
                raise ConflictError("A fee head with this name already exists")
            head.name = name
        for field in ("code", "default_frequency", "description", "is_active"):
            if field in data and (data[field] is not None or field in ("code", "description")):
                setattr(head, field, data[field])
        self.db.commit()
        self.db.refresh(head)
        return head

    def delete_head(self, tenant_id: uuid.UUID, head_id: uuid.UUID) -> str:
        """Hard-deletes an unused head; a head already on a structure or invoice line is only
        deactivated so historical vouchers keep their particulars."""
        head = self._head_or_404(tenant_id, head_id)
        in_structure = any(i.fee_head_id == head.id for i in self.structure.list_for_class(tenant_id))
        in_lines = any(line.fee_head_id == head.id for line in self.lines.list(tenant_id))
        in_concessions = any(c.fee_head_id == head.id for c in self.concessions.list(tenant_id))
        if in_structure or in_lines or in_concessions:
            head.is_active = False
            self.db.commit()
            return "deactivated"
        self.db.delete(head)
        self.db.commit()
        return "deleted"

    def seed_default_heads(self, tenant_id: uuid.UUID) -> list[FeeHead]:
        for name, code, freq in DEFAULT_HEADS:
            if self.heads.get_by_name(tenant_id, name) is None:
                self.heads.create(
                    FeeHead(tenant_id=tenant_id, name=name, code=code, default_frequency=freq, is_active=True)
                )
        self.db.commit()
        return self.heads.list_heads(tenant_id)

    # ------------------------------------------------------------------ fee structure

    def get_structure(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID) -> FeeStructureOut:
        class_grade = self.classes.get_by_id(tenant_id, class_grade_id)
        if class_grade is None:
            raise NotFoundError("Class not found")
        heads = {h.id: h for h in self.heads.list(tenant_id)}
        items = [
            FeeStructureItemOut(
                id=i.id,
                class_grade_id=i.class_grade_id,
                fee_head_id=i.fee_head_id,
                fee_head_name=heads[i.fee_head_id].name if i.fee_head_id in heads else "",
                amount=float(i.amount),
                frequency=i.frequency,
            )
            for i in self.structure.list_for_class(tenant_id, class_grade_id)
        ]
        items.sort(key=lambda x: x.fee_head_name)
        return FeeStructureOut(
            class_grade_id=class_grade.id,
            class_grade_name=class_grade.name,
            items=items,
            monthly_total=sum(i.amount for i in items if i.frequency == FeeFrequency.MONTHLY),
        )

    def set_structure(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, payload: FeeStructureSet) -> FeeStructureOut:
        if self.classes.get_by_id(tenant_id, class_grade_id) is None:
            raise NotFoundError("Class not found")
        seen: set[uuid.UUID] = set()
        for item in payload.items:
            self._head_or_404(tenant_id, item.fee_head_id)
            if item.fee_head_id in seen:
                raise ConflictError("A fee head can appear only once in a class structure")
            seen.add(item.fee_head_id)
        for existing in self.structure.list_for_class(tenant_id, class_grade_id):
            self.db.delete(existing)
        self.db.flush()
        for item in payload.items:
            self.structure.create(
                FeeStructureItem(
                    tenant_id=tenant_id,
                    class_grade_id=class_grade_id,
                    fee_head_id=item.fee_head_id,
                    amount=item.amount,
                    frequency=item.frequency,
                )
            )
        self.db.commit()
        return self.get_structure(tenant_id, class_grade_id)

    # ------------------------------------------------------------------ concessions

    def _concession_out(self, tenant_id: uuid.UUID, c: FeeConcession) -> ConcessionOut:
        head = self.heads.get_by_id(tenant_id, c.fee_head_id) if c.fee_head_id else None
        return ConcessionOut(
            id=c.id,
            student_id=c.student_id,
            student_name=self._student_name(tenant_id, c.student_id),
            fee_head_id=c.fee_head_id,
            fee_head_name=head.name if head else None,
            concession_type=c.concession_type,
            value=float(c.value),
            reason=c.reason,
            valid_from=c.valid_from,
            valid_to=c.valid_to,
            is_active=c.is_active,
        )

    def list_concessions(self, tenant_id: uuid.UUID, student_id: uuid.UUID | None = None) -> list[ConcessionOut]:
        return [self._concession_out(tenant_id, c) for c in self.concessions.list_concessions(tenant_id, student_id)]

    def create_concession(self, tenant_id: uuid.UUID, payload: ConcessionCreate) -> ConcessionOut:
        if self.students.get_by_id(tenant_id, payload.student_id) is None:
            raise NotFoundError("Student not found")
        if payload.fee_head_id is not None:
            self._head_or_404(tenant_id, payload.fee_head_id)
        c = self.concessions.create(FeeConcession(tenant_id=tenant_id, is_active=True, **payload.model_dump()))
        self.db.commit()
        self.db.refresh(c)
        return self._concession_out(tenant_id, c)

    def update_concession(self, tenant_id: uuid.UUID, concession_id: uuid.UUID, payload: ConcessionUpdate) -> ConcessionOut:
        c = self.concessions.get_by_id(tenant_id, concession_id)
        if c is None:
            raise NotFoundError("Concession not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            if value is None and field in ("concession_type", "value", "is_active"):
                continue
            setattr(c, field, value)
        if c.concession_type == ConcessionType.PERCENTAGE and float(c.value) > 100:
            raise DomainError("Percentage concession cannot exceed 100")
        if c.valid_from and c.valid_to and c.valid_to < c.valid_from:
            raise DomainError("valid_to must be on or after valid_from")
        self.db.commit()
        self.db.refresh(c)
        return self._concession_out(tenant_id, c)

    def delete_concession(self, tenant_id: uuid.UUID, concession_id: uuid.UUID) -> None:
        c = self.concessions.get_by_id(tenant_id, concession_id)
        if c is None:
            raise NotFoundError("Concession not found")
        self.db.delete(c)
        self.db.commit()

    @staticmethod
    def _concession_value(c: FeeConcession, base: float) -> float:
        if c.concession_type == ConcessionType.PERCENTAGE:
            return round(base * float(c.value) / 100.0, 2)
        return float(c.value)

    # ------------------------------------------------------------------ late fee rule

    def get_late_fee_rule(self, tenant_id: uuid.UUID) -> LateFeeRuleOut:
        rule = self.late_rules.get_for_tenant(tenant_id)
        if rule is None:
            return LateFeeRuleOut(amount=0, grace_days=0, is_active=False)
        return LateFeeRuleOut(amount=float(rule.amount), grace_days=rule.grace_days, is_active=rule.is_active)

    def set_late_fee_rule(self, tenant_id: uuid.UUID, payload: LateFeeRuleIn) -> LateFeeRuleOut:
        rule = self.late_rules.get_for_tenant(tenant_id)
        if rule is None:
            rule = self.late_rules.create(LateFeeRule(tenant_id=tenant_id, **payload.model_dump()))
        else:
            rule.amount = payload.amount
            rule.grace_days = payload.grace_days
            rule.is_active = payload.is_active
        self.db.commit()
        return self.get_late_fee_rule(tenant_id)

    # ------------------------------------------------------------------ itemised invoices

    def _create_itemized(
        self,
        tenant_id: uuid.UUID,
        student_id: uuid.UUID,
        class_grade_id: uuid.UUID,
        invoice_type: InvoiceType,
        lines: list[tuple[uuid.UUID | None, str, float]],
        due_date: date_,
        period_month: int | None = None,
        period_year: int | None = None,
        notes: str | None = None,
    ) -> Invoice:
        """Creates an invoice + its lines. Head-specific concessions are snapshotted onto each
        line; overall concessions (and, for tuition vouchers, the admission-detail discount the
        legacy generator already used) reduce the invoice total. Does not commit."""
        applicable = self.concessions.list_applicable(tenant_id, student_id, due_date)
        gross = round(sum(amount for _h, _d, amount in lines), 2)
        line_rows: list[tuple[uuid.UUID | None, str, float, float]] = []
        line_concession_total = 0.0
        for head_id, desc, amount in lines:
            conc = 0.0
            if head_id is not None:
                for c in applicable:
                    if c.fee_head_id == head_id:
                        conc += self._concession_value(c, amount)
            conc = min(conc, amount)
            line_concession_total += conc
            line_rows.append((head_id, desc, amount, round(conc, 2)))

        remaining = gross - line_concession_total
        overall = 0.0
        for c in applicable:
            if c.fee_head_id is None:
                overall += self._concession_value(c, remaining)
        if invoice_type == InvoiceType.TUITION:
            overall += self.fee._student_discount(tenant_id, student_id)
        discount = round(min(gross, line_concession_total + overall), 2)

        invoice = self.invoices.create(
            Invoice(
                tenant_id=tenant_id,
                student_id=student_id,
                class_grade_id=class_grade_id,
                invoice_type=invoice_type,
                invoice_number=self.invoices.next_invoice_number(tenant_id),
                period_month=period_month,
                period_year=period_year,
                amount_due=gross,
                discount_amount=discount,
                net_amount=round(gross - discount, 2),
                amount_paid=0,
                late_fee_amount=0,
                due_date=due_date,
                notes=notes,
            )
        )
        for head_id, desc, amount, conc in line_rows:
            self.lines.create(
                InvoiceLine(
                    tenant_id=tenant_id,
                    invoice_id=invoice.id,
                    fee_head_id=head_id,
                    description=desc,
                    amount=amount,
                    concession_amount=conc,
                )
            )
        return invoice

    def generate_structured_invoices(
        self, tenant_id: uuid.UUID, payload: GenerateStructuredInvoicesRequest
    ) -> GenerateStructuredInvoicesResult:
        if self.classes.get_by_id(tenant_id, payload.class_grade_id) is None:
            raise NotFoundError("Class not found")
        items = self.structure.list_for_class(tenant_id, payload.class_grade_id)
        if not items:
            raise NotFoundError("No fee structure set for this class")
        include = set(payload.include_head_ids)
        selected = [i for i in items if i.frequency == FeeFrequency.MONTHLY or i.fee_head_id in include]
        if not selected:
            raise ConflictError("No fee heads selected for this voucher")
        heads = {h.id: h for h in self.heads.list(tenant_id)}
        label = period_label(payload.period_month, payload.period_year)
        line_specs = [
            (i.fee_head_id, f"{heads[i.fee_head_id].name}" + (f" ({label})" if i.frequency == FeeFrequency.MONTHLY else ""), float(i.amount))
            for i in selected
            if i.fee_head_id in heads and float(i.amount) > 0
        ]
        if not line_specs:
            raise ConflictError("Selected fee heads have no amount")

        created: list[Invoice] = []
        skipped = 0
        for profile, _user in self.students.list_with_users(tenant_id, class_grade_id=payload.class_grade_id, status="active"):
            existing = self.invoices.get_for_student_period(
                tenant_id, profile.id, InvoiceType.TUITION, payload.period_month, payload.period_year
            )
            if existing is not None:
                skipped += 1
                continue
            created.append(
                self._create_itemized(
                    tenant_id,
                    profile.id,
                    payload.class_grade_id,
                    InvoiceType.TUITION,
                    line_specs,
                    payload.due_date,
                    payload.period_month,
                    payload.period_year,
                )
            )
        self.db.commit()
        return GenerateStructuredInvoicesResult(
            invoices_created=len(created),
            skipped_existing=skipped,
            invoices=[self.summarize(tenant_id, inv) for inv in created],
        )

    def create_itemized_invoice(self, tenant_id: uuid.UUID, payload: ItemizedInvoiceCreate) -> InvoiceSummaryOut:
        student = self.students.get_by_id(tenant_id, payload.student_id)
        if student is None:
            raise NotFoundError("Student not found")
        if student.class_grade_id is None:
            raise ConflictError("Student is not assigned to a class")
        if payload.period_month and payload.period_year:
            if self.invoices.get_for_student_period(
                tenant_id, student.id, payload.invoice_type, payload.period_month, payload.period_year
            ):
                raise ConflictError("An invoice of this type already exists for this student and period")
        specs: list[tuple[uuid.UUID | None, str, float]] = []
        for line in payload.lines:
            desc = line.description
            if line.fee_head_id is not None:
                head = self._head_or_404(tenant_id, line.fee_head_id)
                desc = desc or head.name
            specs.append((line.fee_head_id, desc or "Fee", line.amount))
        inv = self._create_itemized(
            tenant_id,
            student.id,
            student.class_grade_id,
            payload.invoice_type,
            specs,
            payload.due_date,
            payload.period_month,
            payload.period_year,
            payload.notes,
        )
        self.db.commit()
        return self.summarize(tenant_id, inv)

    def get_invoice_lines(self, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> list[InvoiceLine]:
        self.fee.get_invoice_or_404(tenant_id, invoice_id)
        return self.lines.list_for_invoice(tenant_id, invoice_id)

    def list_invoice_summaries(
        self,
        tenant_id: uuid.UUID,
        class_grade_id: uuid.UUID | None = None,
        student_ids: list[uuid.UUID] | None = None,
        period_month: int | None = None,
        period_year: int | None = None,
        open_only: bool = False,
    ) -> list[InvoiceSummaryOut]:
        invoices = self.invoices.list_invoices(tenant_id, student_ids=student_ids, class_grade_id=class_grade_id)
        out = []
        for inv in invoices:
            if period_month and inv.period_month != period_month:
                continue
            if period_year and inv.period_year != period_year:
                continue
            if open_only and invoice_balance(inv) <= 0:
                continue
            out.append(self.summarize(tenant_id, inv))
        return out

    # ------------------------------------------------------------------ vouchers

    def _voucher_data(self, tenant_id: uuid.UUID, inv: Invoice, tenant_name: str, rule: LateFeeRule | None) -> dict:
        found = self._student(tenant_id, inv.student_id)
        profile, user = found if found else (None, None)
        family = self.families.get_by_id(tenant_id, profile.family_id) if profile and profile.family_id else None
        lines = self.lines.list_for_invoice(tenant_id, inv.id)
        label = period_label(inv.period_month, inv.period_year)
        if lines:
            line_dicts = [{"description": ln.description, "amount": float(ln.amount)} for ln in lines]
        else:
            desc = f"{inv.invoice_type.value.title()} Fee" + (f" ({label})" if label else "")
            line_dicts = [{"description": desc, "amount": float(inv.amount_due)}]
        arrears = sum(
            invoice_balance(other)
            for other in self.invoices.list_invoices(tenant_id, student_id=inv.student_id)
            if other.id != inv.id and other.status in OPEN_STATUSES and other.due_date < inv.due_date
        )
        balance = invoice_balance(inv)
        late_after = 0.0
        if (
            rule is not None
            and rule.is_active
            and float(rule.amount or 0) > 0
            and float(inv.late_fee_amount or 0) == 0
            and inv.status in OPEN_STATUSES
        ):
            late_after = float(rule.amount)
        return {
            "tenant_name": tenant_name,
            "invoice_number": inv.invoice_number,
            "student_name": user.full_name if user else "Unknown student",
            "admission_number": profile.admission_number if profile else None,
            "class_name": self._class_name(tenant_id, inv.class_grade_id),
            "family_number": family.family_number if family else None,
            "period_label": label or inv.invoice_type.value.title(),
            "issue_date": inv.created_at.date() if inv.created_at else date_.today(),
            "due_date": inv.due_date,
            "lines": line_dicts,
            "gross": float(inv.amount_due),
            "concession": float(inv.discount_amount or 0),
            "late_fee_applied": float(inv.late_fee_amount or 0),
            "paid": invoice_paid(inv) if inv.status != InvoiceStatus.PAID else float(inv.net_amount),
            "arrears": round(arrears, 2),
            "payable": round(balance + arrears, 2),
            "late_fee_after_due": late_after,
            "notes": inv.notes,
        }

    def voucher_pdf(self, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> tuple[bytes, str]:
        inv = self.fee.get_invoice_or_404(tenant_id, invoice_id)
        data = self._voucher_data(tenant_id, inv, self._tenant_name(tenant_id), self.late_rules.get_for_tenant(tenant_id))
        return render_fee_vouchers([data]), f"voucher-{inv.invoice_number}.pdf"

    def bulk_vouchers_pdf(
        self,
        tenant_id: uuid.UUID,
        class_grade_id: uuid.UUID | None,
        period_month: int | None,
        period_year: int | None,
        include_paid: bool = False,
    ) -> bytes:
        invoices = self.invoices.list_invoices(tenant_id, class_grade_id=class_grade_id)
        selected = [
            inv
            for inv in invoices
            if (period_month is None or inv.period_month == period_month)
            and (period_year is None or inv.period_year == period_year)
            and (include_paid or inv.status in OPEN_STATUSES)
        ]
        selected.sort(key=lambda inv: (self._student_name(tenant_id, inv.student_id), inv.due_date))
        tenant_name = self._tenant_name(tenant_id)
        rule = self.late_rules.get_for_tenant(tenant_id)
        return render_fee_vouchers([self._voucher_data(tenant_id, inv, tenant_name, rule) for inv in selected])

    # ------------------------------------------------------------------ counter

    def _counter_student(self, tenant_id: uuid.UUID, profile: StudentProfile, user: User) -> CounterStudentOut:
        return CounterStudentOut(
            student_id=profile.id,
            student_name=user.full_name,
            admission_number=profile.admission_number,
            class_grade_name=self._class_name(tenant_id, profile.class_grade_id),
            family_id=profile.family_id,
        )

    def _resolve_account(
        self, tenant_id: uuid.UUID, family_id: uuid.UUID | None, student_id: uuid.UUID | None
    ) -> tuple[Family | None, list[tuple[StudentProfile, User]]]:
        if family_id is not None:
            family = self.families.get_by_id(tenant_id, family_id)
            if family is None:
                raise NotFoundError("Family not found")
            return family, self.students.list_with_users(tenant_id, family_id=family.id, status="all")
        if student_id is None:
            raise DomainError("Provide family_id or student_id")
        found = self.students.get_with_user(tenant_id, student_id)
        if found is None:
            raise NotFoundError("Student not found")
        return None, [found]

    def _open_invoices(self, tenant_id: uuid.UUID, student_ids: list[uuid.UUID]) -> list[Invoice]:
        if not student_ids:
            return []
        invoices = [
            inv
            for inv in self.invoices.list_invoices(tenant_id, student_ids=student_ids)
            if inv.status in OPEN_STATUSES and invoice_balance(inv) > 0
        ]
        invoices.sort(key=lambda inv: (inv.due_date, inv.created_at or datetime.min.replace(tzinfo=timezone.utc)))
        return invoices

    def search_counter(self, tenant_id: uuid.UUID, q: str) -> list[CounterSearchResult]:
        q = (q or "").strip()
        if not q:
            return []
        family_ids: list[uuid.UUID] = []
        single_students: list[tuple[StudentProfile, User]] = []
        for fam in self.families.search(tenant_id, q):
            if fam.id not in family_ids:
                family_ids.append(fam.id)
        for profile, user in self.students.list_with_users(tenant_id, status="all", query=q):
            if profile.family_id is not None:
                if profile.family_id not in family_ids:
                    family_ids.append(profile.family_id)
            else:
                single_students.append((profile, user))

        results: list[CounterSearchResult] = []
        for fid in family_ids[:25]:
            fam = self.families.get_by_id(tenant_id, fid)
            if fam is None:
                continue
            members = self.students.list_with_users(tenant_id, family_id=fid, status="all")
            open_inv = self._open_invoices(tenant_id, [p.id for p, _u in members])
            results.append(
                CounterSearchResult(
                    family_id=fam.id,
                    family_number=fam.family_number,
                    family_name=fam.family_name,
                    students=[self._counter_student(tenant_id, p, u) for p, u in members],
                    outstanding=round(sum(invoice_balance(i) for i in open_inv), 2),
                )
            )
        for profile, user in single_students[:25]:
            open_inv = self._open_invoices(tenant_id, [profile.id])
            results.append(
                CounterSearchResult(
                    family_id=None,
                    family_number=None,
                    family_name=None,
                    students=[self._counter_student(tenant_id, profile, user)],
                    outstanding=round(sum(invoice_balance(i) for i in open_inv), 2),
                )
            )
        # exact family-number / admission-number hits first
        results.sort(
            key=lambda r: 0
            if (r.family_number == q or any(s.admission_number == q for s in r.students))
            else 1
        )
        return results

    def get_counter_account(
        self,
        tenant_id: uuid.UUID,
        family_id: uuid.UUID | None,
        student_id: uuid.UUID | None,
        on_date: date_ | None = None,
    ) -> CounterAccountOut:
        on_date = on_date or date_.today()
        family, members = self._resolve_account(tenant_id, family_id, student_id)
        open_inv = self._open_invoices(tenant_id, [p.id for p, _u in members])
        rule = self.late_rules.get_for_tenant(tenant_id)
        pending_late = 0.0
        if rule is not None and rule.is_active and float(rule.amount or 0) > 0:
            for inv in open_inv:
                if float(inv.late_fee_amount or 0) == 0 and on_date > inv.due_date + timedelta(days=rule.grace_days or 0):
                    pending_late += float(rule.amount)
        return CounterAccountOut(
            family_id=family.id if family else None,
            family_number=family.family_number if family else None,
            family_name=family.family_name if family else None,
            students=[self._counter_student(tenant_id, p, u) for p, u in members],
            open_invoices=[self.summarize(tenant_id, inv) for inv in open_inv],
            total_outstanding=round(sum(invoice_balance(i) for i in open_inv), 2),
            pending_late_fee=round(pending_late, 2),
        )

    def collect(self, tenant_id: uuid.UUID, collector: User, payload: CollectRequest) -> ReceiptOut:
        """Cash-desk collection: applies any due late fee as of collected_on, then allocates the
        received amount oldest-due-first across the account's open invoices, creating one
        already-VERIFIED Payment per invoice touched, all grouped under one receipt."""
        collected_on = payload.collected_on or date_.today()
        family, members = self._resolve_account(tenant_id, payload.family_id, payload.student_id)
        open_inv = self._open_invoices(tenant_id, [p.id for p, _u in members])
        if payload.invoice_ids:
            wanted = set(payload.invoice_ids)
            if not wanted.issubset({i.id for i in open_inv}):
                raise DomainError("One or more selected invoices are not open invoices of this account")
            open_inv = [i for i in open_inv if i.id in wanted]
        if not open_inv:
            raise ConflictError("No outstanding invoices for this account")

        rule = self.late_rules.get_for_tenant(tenant_id)
        for inv in open_inv:
            self.fee.sync_paid_state(tenant_id, inv)  # heal legacy rows lacking amount_paid
            apply_late_fee(inv, rule, collected_on)
        open_inv = [i for i in open_inv if invoice_balance(i) > 0]
        outstanding = round(sum(invoice_balance(i) for i in open_inv), 2)
        if not open_inv:
            self.db.commit()
            raise ConflictError("No outstanding invoices for this account")
        if payload.amount > outstanding + 0.005:
            raise DomainError(f"Amount exceeds the outstanding balance of {outstanding:,.2f}")

        now = datetime.now(timezone.utc)
        submitted_at = now if collected_on == now.date() else datetime.combine(collected_on, time(12, 0), tzinfo=timezone.utc)
        receipt = self.receipts.create(
            FeeReceipt(
                tenant_id=tenant_id,
                receipt_number=self.receipts.next_receipt_number(tenant_id),
                family_id=family.id if family else None,
                student_id=payload.student_id if family is None else None,
                total_amount=round(payload.amount, 2),
                payment_method=payload.payment_method,
                collected_on=collected_on,
                collected_by_user_id=collector.id,
                reference_note=payload.reference_note,
            )
        )
        remaining = round(payload.amount, 2)
        for inv in open_inv:
            if remaining <= 0.005:
                break
            pay = round(min(remaining, invoice_balance(inv)), 2)
            if pay <= 0:
                continue
            self.payments.create(
                Payment(
                    tenant_id=tenant_id,
                    invoice_id=inv.id,
                    amount=pay,
                    payment_method=payload.payment_method,
                    reference_note=f"Counter receipt {receipt.receipt_number}"
                    + (f" - {payload.reference_note}" if payload.reference_note else ""),
                    submitted_by_user_id=collector.id,
                    submitted_at=submitted_at,
                    verification_status=PaymentVerificationStatus.VERIFIED,
                    verified_by_user_id=collector.id,
                    verified_at=now,
                    receipt_id=receipt.id,
                )
            )
            self.fee.sync_paid_state(tenant_id, inv)
            remaining = round(remaining - pay, 2)
        self.db.commit()
        self.db.refresh(receipt)
        return self.receipt_out(tenant_id, receipt)

    # ------------------------------------------------------------------ receipts

    def get_receipt_or_404(self, tenant_id: uuid.UUID, receipt_id: uuid.UUID) -> FeeReceipt:
        receipt = self.receipts.get_by_id(tenant_id, receipt_id)
        if receipt is None:
            raise NotFoundError("Receipt not found")
        return receipt

    def receipt_out(self, tenant_id: uuid.UUID, receipt: FeeReceipt) -> ReceiptOut:
        family = self.families.get_by_id(tenant_id, receipt.family_id) if receipt.family_id else None
        collector = self.users.get_by_id(tenant_id, receipt.collected_by_user_id)
        allocations = []
        for p in self.receipts.list_payments(tenant_id, receipt.id):
            inv = self.invoices.get_by_id(tenant_id, p.invoice_id)
            if inv is None:
                continue
            allocations.append(
                ReceiptAllocationOut(
                    payment_id=p.id,
                    invoice_id=inv.id,
                    invoice_number=inv.invoice_number,
                    student_name=self._student_name(tenant_id, inv.student_id),
                    amount=float(p.amount),
                    invoice_balance_after=invoice_balance(inv),
                    invoice_status=inv.status,
                )
            )
        allocations.sort(key=lambda a: a.invoice_number)
        payer = family.family_name if family else self._student_name(tenant_id, receipt.student_id)
        return ReceiptOut(
            id=receipt.id,
            receipt_number=receipt.receipt_number,
            family_id=receipt.family_id,
            family_name=family.family_name if family else None,
            student_id=receipt.student_id,
            payer_name=payer or "-",
            total_amount=float(receipt.total_amount),
            payment_method=receipt.payment_method,
            collected_on=receipt.collected_on,
            collected_by_name=collector.full_name if collector else "-",
            reference_note=receipt.reference_note,
            created_at=receipt.created_at,
            allocations=allocations,
        )

    def list_receipts(
        self,
        tenant_id: uuid.UUID,
        date_from: date_ | None = None,
        date_to: date_ | None = None,
        family_id: uuid.UUID | None = None,
    ) -> list[ReceiptOut]:
        return [self.receipt_out(tenant_id, r) for r in self.receipts.list_receipts(tenant_id, date_from, date_to, family_id=family_id)]

    def receipt_student_ids(self, tenant_id: uuid.UUID, receipt: FeeReceipt) -> set[uuid.UUID]:
        ids: set[uuid.UUID] = set()
        for p in self.receipts.list_payments(tenant_id, receipt.id):
            inv = self.invoices.get_by_id(tenant_id, p.invoice_id)
            if inv is not None:
                ids.add(inv.student_id)
        return ids

    def assert_receipt_visible(self, tenant_id: uuid.UUID, receipt: FeeReceipt, child_ids: set[uuid.UUID]) -> None:
        if not (self.receipt_student_ids(tenant_id, receipt) & child_ids):
            raise ForbiddenError("Not your receipt")

    def list_receipts_for_students(self, tenant_id: uuid.UUID, student_ids: list[uuid.UUID]) -> list[ReceiptOut]:
        if not student_ids:
            return []
        invoice_ids = [i.id for i in self.invoices.list_invoices(tenant_id, student_ids=student_ids)]
        receipt_ids: list[uuid.UUID] = []
        for p in self.receipts.list_verified_payments(tenant_id, invoice_ids):
            if p.receipt_id is not None and p.receipt_id not in receipt_ids:
                receipt_ids.append(p.receipt_id)
        receipts = [r for rid in receipt_ids if (r := self.receipts.get_by_id(tenant_id, rid)) is not None]
        receipts.sort(key=lambda r: (r.collected_on, r.receipt_number), reverse=True)
        return [self.receipt_out(tenant_id, r) for r in receipts]

    def receipt_pdf(self, tenant_id: uuid.UUID, receipt: FeeReceipt) -> tuple[bytes, str]:
        out = self.receipt_out(tenant_id, receipt)
        family = self.families.get_by_id(tenant_id, receipt.family_id) if receipt.family_id else None
        data = {
            "tenant_name": self._tenant_name(tenant_id),
            "receipt_number": out.receipt_number,
            "collected_on": out.collected_on,
            "payer_name": out.payer_name,
            "payment_method": out.payment_method.value.replace("_", " ").title(),
            "family_number": family.family_number if family else None,
            "collected_by_name": out.collected_by_name,
            "reference_note": out.reference_note,
            "total_amount": out.total_amount,
            "allocations": [
                {
                    "invoice_number": a.invoice_number,
                    "student_name": a.student_name,
                    "amount": a.amount,
                    "balance_after": a.invoice_balance_after,
                }
                for a in out.allocations
            ],
        }
        return render_payment_receipt(data), f"receipt-{out.receipt_number}.pdf"

    # ------------------------------------------------------------------ defaulters

    def defaulters(
        self,
        tenant_id: uuid.UUID,
        class_grade_id: uuid.UUID | None = None,
        min_amount: float | None = None,
        months_overdue: int | None = None,
        today: date_ | None = None,
    ) -> list[DefaulterRow]:
        today = today or date_.today()
        by_student: dict[uuid.UUID, list[Invoice]] = defaultdict(list)
        for inv in self.invoices.list_invoices(tenant_id):
            if inv.status in OPEN_STATUSES and inv.due_date < today and invoice_balance(inv) > 0:
                by_student[inv.student_id].append(inv)
        rows: list[DefaulterRow] = []
        for student_id, invs in by_student.items():
            found = self._student(tenant_id, student_id)
            if found is None:
                continue
            profile, user = found
            current_class = profile.class_grade_id or invs[0].class_grade_id
            if class_grade_id is not None and current_class != class_grade_id:
                continue
            oldest = min(i.due_date for i in invs)
            months = months_between(oldest, today)
            balance = round(sum(invoice_balance(i) for i in invs), 2)
            if min_amount is not None and balance < min_amount:
                continue
            if months_overdue is not None and months < months_overdue:
                continue
            family = self.families.get_by_id(tenant_id, profile.family_id) if profile.family_id else None
            rows.append(
                DefaulterRow(
                    student_id=student_id,
                    student_name=user.full_name,
                    admission_number=profile.admission_number,
                    class_grade_id=current_class,
                    class_grade_name=self._class_name(tenant_id, current_class),
                    family_id=profile.family_id,
                    family_number=family.family_number if family else None,
                    family_name=family.family_name if family else None,
                    overdue_invoices=len(invs),
                    oldest_due_date=oldest,
                    months_overdue=months,
                    overdue_balance=balance,
                )
            )
        rows.sort(key=lambda r: r.overdue_balance, reverse=True)
        return rows

    def defaulters_xlsx(self, rows: list[DefaulterRow]) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = "Defaulters"
        ws.append(
            ["Student", "Admission No.", "Class", "Family No.", "Family", "Overdue Invoices", "Oldest Due Date", "Months Overdue", "Overdue Balance"]
        )
        for r in rows:
            ws.append(
                [
                    r.student_name,
                    r.admission_number or "",
                    r.class_grade_name or "",
                    r.family_number or "",
                    r.family_name or "",
                    r.overdue_invoices,
                    r.oldest_due_date.isoformat(),
                    r.months_overdue,
                    r.overdue_balance,
                ]
            )
        ws.append([])
        ws.append(["Total", "", "", "", "", sum(r.overdue_invoices for r in rows), "", "", sum(r.overdue_balance for r in rows)])
        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()

    def send_reminders(self, tenant_id: uuid.UUID, rows: list[DefaulterRow]) -> ReminderResult:
        from app.services.notification_service import NotificationService

        notifier = NotificationService(self.db)
        logged = 0
        reminded = 0
        for r in rows:
            invs = self._open_invoices(tenant_id, [r.student_id])
            if not invs:
                continue
            try:
                logs = notifier.send_fee_due_reminder(
                    tenant_id,
                    r.student_id,
                    r.student_name,
                    invs[0].invoice_number,
                    r.overdue_balance,
                    r.oldest_due_date.isoformat(),
                )
            except Exception:  # a notification failure must never break the batch
                continue
            reminded += 1
            logged += len(logs)
        return ReminderResult(students_reminded=reminded, notifications_logged=logged)

    # ------------------------------------------------------------------ ledger

    def _payment_date(self, p: Payment, receipts: dict[uuid.UUID, FeeReceipt]) -> date_:
        if p.receipt_id is not None and p.receipt_id in receipts:
            return receipts[p.receipt_id].collected_on
        stamp = p.verified_at or p.submitted_at
        return stamp.date() if stamp else date_.today()

    def ledger(self, tenant_id: uuid.UUID, family_id: uuid.UUID | None, student_id: uuid.UUID | None) -> LedgerOut:
        family, members = self._resolve_account(tenant_id, family_id, student_id)
        student_ids = [p.id for p, _u in members]
        invoices = self.invoices.list_invoices(tenant_id, student_ids=student_ids) if student_ids else []
        invoices = [i for i in invoices if i.status != InvoiceStatus.WAIVED]
        inv_by_id = {i.id: i for i in invoices}
        payments = self.receipts.list_verified_payments(tenant_id, list(inv_by_id.keys())) if inv_by_id else []
        receipts = {r.id: r for r in self.receipts.list(tenant_id)} if payments else {}

        raw: list[tuple[date_, int, str, str, str, float, float]] = []
        for inv in invoices:
            label = period_label(inv.period_month, inv.period_year)
            desc = f"{inv.invoice_type.value.title()} voucher" + (f" {label}" if label else "")
            if float(inv.discount_amount or 0) > 0:
                desc += f" (concession {float(inv.discount_amount):,.0f})"
            if float(inv.late_fee_amount or 0) > 0:
                desc += f" incl. late fee {float(inv.late_fee_amount):,.0f}"
            issued = inv.created_at.date() if inv.created_at else inv.due_date
            raw.append((issued, 0, inv.invoice_number, desc, self._student_name(tenant_id, inv.student_id), float(inv.net_amount), 0.0))
        for p in payments:
            inv = inv_by_id[p.invoice_id]
            rcpt = receipts.get(p.receipt_id) if p.receipt_id else None
            ref = rcpt.receipt_number if rcpt else f"PAY-{str(p.id)[:8]}"
            desc = f"Payment ({p.payment_method.value.replace('_', ' ')}) against #{inv.invoice_number}"
            raw.append((self._payment_date(p, receipts), 1, ref, desc, self._student_name(tenant_id, inv.student_id), 0.0, float(p.amount)))
        raw.sort(key=lambda e: (e[0], e[1], e[2]))

        balance = 0.0
        entries: list[LedgerEntry] = []
        for d, kind, ref, desc, sname, debit, credit in raw:
            balance = round(balance + debit - credit, 2)
            entries.append(
                LedgerEntry(
                    entry_date=d,
                    kind="invoice" if kind == 0 else "payment",
                    reference=ref,
                    description=desc,
                    student_name=sname,
                    debit=debit,
                    credit=credit,
                    balance=balance,
                )
            )
        return LedgerOut(
            family_id=family.id if family else None,
            family_number=family.family_number if family else None,
            family_name=family.family_name if family else None,
            students=[self._counter_student(tenant_id, p, u) for p, u in members],
            entries=entries,
            total_billed=round(sum(e.debit for e in entries), 2),
            total_paid=round(sum(e.credit for e in entries), 2),
            closing_balance=balance,
        )

    def ledger_student_ids(self, tenant_id: uuid.UUID, family_id: uuid.UUID | None, student_id: uuid.UUID | None) -> set[uuid.UUID]:
        _family, members = self._resolve_account(tenant_id, family_id, student_id)
        return {p.id for p, _u in members}

    def ledger_pdf(self, tenant_id: uuid.UUID, family_id: uuid.UUID | None, student_id: uuid.UUID | None) -> bytes:
        led = self.ledger(tenant_id, family_id, student_id)
        account = (
            f"Family #{led.family_number} - {led.family_name}" if led.family_id else (led.students[0].student_name if led.students else "-")
        )
        return render_family_ledger(
            {
                "tenant_name": self._tenant_name(tenant_id),
                "account_label": account,
                "students_label": ", ".join(
                    f"{s.student_name} ({s.class_grade_name or '-'})" for s in led.students
                ) or "-",
                "entries": [e.model_dump() for e in led.entries],
                "total_billed": led.total_billed,
                "total_paid": led.total_paid,
                "closing_balance": led.closing_balance,
            }
        )

    # ------------------------------------------------------------------ reports

    def daily_collection(
        self,
        tenant_id: uuid.UUID,
        date_from: date_,
        date_to: date_,
        payment_method: str | None = None,
        collector_id: uuid.UUID | None = None,
    ) -> DailyCollectionReport:
        if date_to < date_from:
            raise DomainError("date_to must be on or after date_from")
        payments = self.receipts.list_verified_payments(tenant_id)
        receipts = {r.id: r for r in self.receipts.list(tenant_id)}
        user_names: dict[uuid.UUID, str] = {}
        rows: list[CollectionPaymentRow] = []
        for p in payments:
            day = self._payment_date(p, receipts)
            if day < date_from or day > date_to:
                continue
            if payment_method and p.payment_method.value != payment_method:
                continue
            rcpt = receipts.get(p.receipt_id) if p.receipt_id else None
            coll_id = rcpt.collected_by_user_id if rcpt else p.verified_by_user_id
            if collector_id is not None and coll_id != collector_id:
                continue
            if coll_id is not None and coll_id not in user_names:
                u = self.users.get_by_id(tenant_id, coll_id)
                user_names[coll_id] = u.full_name if u else "Unknown"
            inv = self.invoices.get_by_id(tenant_id, p.invoice_id)
            if inv is None:
                continue
            rows.append(
                CollectionPaymentRow(
                    payment_id=p.id,
                    collected_on=day,
                    receipt_number=rcpt.receipt_number if rcpt else None,
                    invoice_number=inv.invoice_number,
                    student_name=self._student_name(tenant_id, inv.student_id),
                    class_grade_name=self._class_name(tenant_id, inv.class_grade_id),
                    payment_method=p.payment_method,
                    collector_name=user_names.get(coll_id) if coll_id else "Online gateway",
                    amount=float(p.amount),
                )
            )
        rows.sort(key=lambda r: (r.collected_on, r.receipt_number or "", r.invoice_number))
        by_day: dict[date_, list[float]] = defaultdict(list)
        by_method: dict[str, float] = defaultdict(float)
        by_collector: dict[str, float] = defaultdict(float)
        for r in rows:
            by_day[r.collected_on].append(r.amount)
            by_method[r.payment_method.value] += r.amount
            by_collector[r.collector_name or "Unknown"] += r.amount
        return DailyCollectionReport(
            date_from=date_from,
            date_to=date_to,
            total=round(sum(r.amount for r in rows), 2),
            by_day=[DailyCollectionDay(day=d, total=round(sum(v), 2), count=len(v)) for d, v in sorted(by_day.items())],
            by_method={k: round(v, 2) for k, v in by_method.items()},
            by_collector={k: round(v, 2) for k, v in by_collector.items()},
            payments=rows,
        )

    def daily_collection_xlsx(self, report: DailyCollectionReport) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = "Collections"
        ws.append(["Collection Report", report.date_from.isoformat(), report.date_to.isoformat()])
        ws.append([])
        ws.append(["Date", "Receipt", "Voucher", "Student", "Class", "Method", "Collector", "Amount"])
        for r in report.payments:
            ws.append(
                [
                    r.collected_on.isoformat(),
                    r.receipt_number or "",
                    r.invoice_number,
                    r.student_name,
                    r.class_grade_name or "",
                    r.payment_method.value,
                    r.collector_name or "",
                    r.amount,
                ]
            )
        ws.append(["Total", "", "", "", "", "", "", report.total])
        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()

    def class_summary(
        self, tenant_id: uuid.UUID, period_month: int | None = None, period_year: int | None = None
    ) -> ClassCollectionSummary:
        groups: dict[uuid.UUID, list[Invoice]] = defaultdict(list)
        for inv in self.invoices.list_invoices(tenant_id):
            if inv.status == InvoiceStatus.WAIVED:
                continue
            if period_month and inv.period_month != period_month:
                continue
            if period_year and inv.period_year != period_year:
                continue
            groups[inv.class_grade_id].append(inv)
        rows = []
        for cid, invs in groups.items():
            rows.append(
                ClassCollectionRow(
                    class_grade_id=cid,
                    class_grade_name=self._class_name(tenant_id, cid) or "",
                    students=len({i.student_id for i in invs}),
                    invoices=len(invs),
                    billed=round(sum(float(i.net_amount) for i in invs), 2),
                    collected=round(sum(invoice_paid(i) for i in invs), 2),
                    outstanding=round(sum(invoice_balance(i) for i in invs), 2),
                )
            )
        rows.sort(key=lambda r: r.class_grade_name)
        return ClassCollectionSummary(
            period_month=period_month,
            period_year=period_year,
            rows=rows,
            total_billed=round(sum(r.billed for r in rows), 2),
            total_collected=round(sum(r.collected for r in rows), 2),
            total_outstanding=round(sum(r.outstanding for r in rows), 2),
        )
