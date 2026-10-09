"""Double-entry accounting: chart of accounts, vouchers, quick entries, period close,
sync from fees/payouts, and financial reports. Only POSTED vouchers affect reports."""

import calendar
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.models.accounting import (
    Account,
    AccountingSourceLink,
    AccountType,
    FinancialPeriod,
    PeriodStatus,
    Voucher,
    VoucherLine,
    VoucherStatus,
    VoucherType,
)
from app.models.fee import Invoice, InvoiceType, Payment, PaymentMethod, PaymentVerificationStatus
from app.models.payout import PayoutStatus, TeacherPayout
from app.models.user import TeacherProfile, User
from app.repositories.accounting_repo import (
    AccountRepository,
    PeriodRepository,
    SourceLinkRepository,
    VoucherRepository,
)
from app.schemas.accounting import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    BalanceSheetReport,
    DayBookReport,
    IncomeStatementReport,
    LedgerEntry,
    LedgerReport,
    MonthlyPoint,
    PeriodOut,
    QuickEntryCreate,
    SeedResult,
    StatementRow,
    SyncResult,
    SyncStatus,
    TrialBalanceReport,
    TrialBalanceRow,
    VoucherCreate,
    VoucherLineIn,
    VoucherLineOut,
    VoucherOut,
    VoucherReverseRequest,
    VoucherUpdate,
)


class UnprocessableError(DomainError):
    status_code = 422


CENT = Decimal("0.01")
DEBIT_NORMAL = {AccountType.ASSET, AccountType.EXPENSE}

# Default chart: (code, name, type, parent_code, subtype)
DEFAULT_CHART: list[tuple[str, str, AccountType, str | None, str | None]] = [
    ("1000", "Assets", AccountType.ASSET, None, None),
    ("1100", "Current Assets", AccountType.ASSET, "1000", None),
    ("1110", "Cash in Hand", AccountType.ASSET, "1100", "cash"),
    ("1120", "Bank Account", AccountType.ASSET, "1100", "bank"),
    ("1130", "Fee Receivable", AccountType.ASSET, "1100", None),
    ("1140", "Inventory / Stock", AccountType.ASSET, "1100", None),
    ("1200", "Fixed Assets", AccountType.ASSET, "1000", None),
    ("1210", "Furniture & Fixtures", AccountType.ASSET, "1200", None),
    ("1220", "Computers & Equipment", AccountType.ASSET, "1200", None),
    ("1230", "Vehicles", AccountType.ASSET, "1200", None),
    ("2000", "Liabilities", AccountType.LIABILITY, None, None),
    ("2100", "Accounts Payable", AccountType.LIABILITY, "2000", None),
    ("2200", "Salaries Payable", AccountType.LIABILITY, "2000", None),
    ("2300", "Advance Fee Received", AccountType.LIABILITY, "2000", None),
    ("3000", "Equity", AccountType.EQUITY, None, None),
    ("3100", "Owner's Capital", AccountType.EQUITY, "3000", None),
    ("3200", "Retained Earnings", AccountType.EQUITY, "3000", None),
    ("4000", "Income", AccountType.INCOME, None, None),
    ("4100", "Fee Income", AccountType.INCOME, "4000", None),
    ("4200", "Admission Fee Income", AccountType.INCOME, "4000", None),
    ("4300", "Other Fee Income", AccountType.INCOME, "4000", None),
    ("4400", "Shop Sales Income", AccountType.INCOME, "4000", None),
    ("4900", "Other Income", AccountType.INCOME, "4000", None),
    ("5000", "Expenses", AccountType.EXPENSE, None, None),
    ("5100", "Salary Expense", AccountType.EXPENSE, "5000", None),
    ("5110", "Teacher Payout Expense", AccountType.EXPENSE, "5000", None),
    ("5200", "Rent Expense", AccountType.EXPENSE, "5000", None),
    ("5300", "Utilities Expense", AccountType.EXPENSE, "5000", None),
    ("5400", "Stationery & Supplies", AccountType.EXPENSE, "5000", None),
    ("5500", "Repairs & Maintenance", AccountType.EXPENSE, "5000", None),
    ("5600", "Transport Expense", AccountType.EXPENSE, "5000", None),
    ("5900", "Miscellaneous Expense", AccountType.EXPENSE, "5000", None),
]

CODE_CASH, CODE_BANK = "1110", "1120"
CODE_FEE_INCOME = {InvoiceType.TUITION: "4100", InvoiceType.ADMISSION: "4200", InvoiceType.OTHER: "4300"}
CODE_PAYOUT_EXPENSE = "5110"
SOURCE_FEE_PAYMENT = "fee_payment"
SOURCE_TEACHER_PAYOUT = "teacher_payout"


def _d(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def _f(value: Decimal) -> float:
    return float(value.quantize(CENT, rounding=ROUND_HALF_UP))


def _signed(account_type: AccountType, debit: Decimal, credit: Decimal) -> Decimal:
    """Balance in the account's natural direction (positive = normal balance)."""
    return debit - credit if account_type in DEBIT_NORMAL else credit - debit


class AccountingService:
    def __init__(self, db: Session):
        self.db = db
        self.accounts = AccountRepository(db)
        self.vouchers = VoucherRepository(db)
        self.periods = PeriodRepository(db)
        self.links = SourceLinkRepository(db)

    # ================= Chart of accounts =================
    def list_accounts(self, tenant_id: uuid.UUID, active_only: bool = False) -> list[AccountOut]:
        accounts = self.accounts.list_ordered(tenant_id, active_only)
        totals = self._account_totals(tenant_id)
        out = []
        for acc in accounts:
            dr, cr = totals.get(acc.id, (Decimal(0), Decimal(0)))
            item = AccountOut.model_validate(acc)
            item.balance = _f(_signed(acc.account_type, dr, cr))
            out.append(item)
        return out

    def get_account(self, tenant_id: uuid.UUID, account_id: uuid.UUID) -> Account:
        acc = self.accounts.get_by_id(tenant_id, account_id)
        if acc is None:
            raise NotFoundError("Account not found")
        return acc

    def _validate_parent(self, tenant_id: uuid.UUID, parent_id: uuid.UUID | None, account_type: AccountType,
                         self_id: uuid.UUID | None = None) -> None:
        if parent_id is None:
            return
        parent = self.get_account(tenant_id, parent_id)
        if parent.account_type != account_type:
            raise UnprocessableError("Parent account must be of the same account type")
        # prevent cycles
        cursor: Account | None = parent
        while cursor is not None:
            if self_id is not None and cursor.id == self_id:
                raise UnprocessableError("An account cannot be its own ancestor")
            cursor = self.accounts.get_by_id(tenant_id, cursor.parent_id) if cursor.parent_id else None

    def create_account(self, tenant_id: uuid.UUID, payload: AccountCreate) -> Account:
        if self.accounts.get_by_code(tenant_id, payload.code):
            raise ConflictError(f"Account code {payload.code} already exists")
        self._validate_parent(tenant_id, payload.parent_id, payload.account_type)
        acc = self.accounts.create(Account(tenant_id=tenant_id, **payload.model_dump()))
        self.db.commit()
        self.db.refresh(acc)
        return acc

    def update_account(self, tenant_id: uuid.UUID, account_id: uuid.UUID, payload: AccountUpdate) -> Account:
        acc = self.get_account(tenant_id, account_id)
        data = payload.model_dump(exclude_unset=True)
        if "code" in data and data["code"] != acc.code and self.accounts.get_by_code(tenant_id, data["code"]):
            raise ConflictError(f"Account code {data['code']} already exists")
        if "parent_id" in data:
            self._validate_parent(tenant_id, data["parent_id"], acc.account_type, acc.id)
        for field, value in data.items():
            setattr(acc, field, value)
        self.db.commit()
        self.db.refresh(acc)
        return acc

    def delete_account(self, tenant_id: uuid.UUID, account_id: uuid.UUID) -> None:
        acc = self.get_account(tenant_id, account_id)
        if self.accounts.has_children(tenant_id, acc.id):
            raise ConflictError("Account has sub-accounts; delete or move them first")
        if self.accounts.has_lines(tenant_id, acc.id):
            raise ConflictError("Account has voucher entries; deactivate it instead")
        self.db.delete(acc)
        self.db.commit()

    def seed_default_chart(self, tenant_id: uuid.UUID, commit: bool = True) -> SeedResult:
        created = 0
        by_code: dict[str, Account] = {a.code: a for a in self.accounts.list(tenant_id)}
        for code, name, acc_type, parent_code, subtype in DEFAULT_CHART:
            if code in by_code:
                continue
            parent = by_code.get(parent_code) if parent_code else None
            acc = self.accounts.create(
                Account(
                    tenant_id=tenant_id,
                    code=code,
                    name=name,
                    account_type=acc_type,
                    parent_id=parent.id if parent else None,
                    subtype=subtype,
                    is_system=True,
                )
            )
            by_code[code] = acc
            created += 1
        if commit:
            self.db.commit()
        return SeedResult(created=created, total=len(by_code))

    # ================= Periods =================
    def is_period_closed(self, tenant_id: uuid.UUID, on: date) -> bool:
        period = self.periods.get_month(tenant_id, on.year, on.month)
        return period is not None and period.status == PeriodStatus.CLOSED

    def _ensure_open(self, tenant_id: uuid.UUID, on: date) -> None:
        if self.is_period_closed(tenant_id, on):
            raise UnprocessableError(f"Financial period {on.year}-{on.month:02d} is closed")

    def list_periods(self, tenant_id: uuid.UUID, year: int) -> list[PeriodOut]:
        rows = {p.month: p for p in self.periods.list_year(tenant_id, year)}
        out = []
        for month in range(1, 13):
            p = rows.get(month)
            out.append(
                PeriodOut(
                    year=year,
                    month=month,
                    status=p.status if p else PeriodStatus.OPEN,
                    closed_at=p.closed_at if p else None,
                )
            )
        return out

    def set_period_status(self, tenant_id: uuid.UUID, user_id: uuid.UUID, year: int, month: int,
                          status: PeriodStatus) -> PeriodOut:
        period = self.periods.get_month(tenant_id, year, month)
        if period is None:
            period = self.periods.create(FinancialPeriod(tenant_id=tenant_id, year=year, month=month))
        period.status = status
        if status == PeriodStatus.CLOSED:
            period.closed_at = datetime.now(timezone.utc)
            period.closed_by_user_id = user_id
        else:
            period.closed_at = None
            period.closed_by_user_id = None
        self.db.commit()
        return PeriodOut(year=year, month=month, status=period.status, closed_at=period.closed_at)

    # ================= Vouchers =================
    def _next_number(self, tenant_id: uuid.UUID, voucher_type: VoucherType) -> str:
        prefix = f"{voucher_type.value}-"
        highest = 0
        for number in self.vouchers.numbers_for_type(tenant_id, voucher_type):
            tail = number[len(prefix):] if number.startswith(prefix) else ""
            if tail.isdigit():
                highest = max(highest, int(tail))
        return f"{prefix}{highest + 1:04d}"

    def _build_lines(self, tenant_id: uuid.UUID, lines: list[VoucherLineIn]) -> list[VoucherLine]:
        if len(lines) < 2:
            raise UnprocessableError("A voucher needs at least two lines")
        total_dr = total_cr = Decimal(0)
        built: list[VoucherLine] = []
        for idx, line in enumerate(lines):
            dr, cr = _d(line.debit), _d(line.credit)
            if (dr > 0) == (cr > 0):
                raise UnprocessableError(f"Line {idx + 1}: enter either a debit or a credit amount")
            acc = self.accounts.get_by_id(tenant_id, line.account_id)
            if acc is None:
                raise UnprocessableError(f"Line {idx + 1}: account not found")
            if not acc.is_active:
                raise UnprocessableError(f"Line {idx + 1}: account {acc.code} is inactive")
            total_dr += dr
            total_cr += cr
            built.append(
                VoucherLine(
                    tenant_id=tenant_id, account_id=acc.id, line_no=idx + 1, debit=dr, credit=cr,
                    description=line.description,
                )
            )
        if total_dr != total_cr:
            raise UnprocessableError(
                f"Voucher is not balanced: total debit {total_dr} does not equal total credit {total_cr}"
            )
        return built

    def get_voucher(self, tenant_id: uuid.UUID, voucher_id: uuid.UUID) -> Voucher:
        v = self.vouchers.get_with_lines(tenant_id, voucher_id)
        if v is None:
            raise NotFoundError("Voucher not found")
        return v

    def _create_voucher(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID | None,
        *,
        voucher_type: VoucherType,
        voucher_date: date,
        lines: list[VoucherLineIn],
        narration: str | None = None,
        reference: str | None = None,
        payee: str | None = None,
        attachment_url: str | None = None,
        post: bool = False,
        source: str = "manual",
        reversal_of_id: uuid.UUID | None = None,
    ) -> Voucher:
        built = self._build_lines(tenant_id, lines)
        if post:
            self._ensure_open(tenant_id, voucher_date)
        voucher = Voucher(
            tenant_id=tenant_id,
            voucher_type=voucher_type,
            voucher_number=self._next_number(tenant_id, voucher_type),
            voucher_date=voucher_date,
            narration=narration,
            reference=reference,
            payee=payee,
            attachment_url=attachment_url,
            status=VoucherStatus.POSTED if post else VoucherStatus.DRAFT,
            posted_at=datetime.now(timezone.utc) if post else None,
            source=source,
            reversal_of_id=reversal_of_id,
            created_by_user_id=user_id,
        )
        voucher.lines = built
        self.db.add(voucher)
        self.db.flush()
        return voucher

    def create_voucher(self, tenant_id: uuid.UUID, user_id: uuid.UUID, payload: VoucherCreate) -> VoucherOut:
        v = self._create_voucher(
            tenant_id, user_id,
            voucher_type=payload.voucher_type, voucher_date=payload.voucher_date, lines=payload.lines,
            narration=payload.narration, reference=payload.reference, payee=payload.payee,
            attachment_url=payload.attachment_url, post=payload.post,
        )
        self.db.commit()
        return self.voucher_out(tenant_id, self.get_voucher(tenant_id, v.id))

    def update_voucher(self, tenant_id: uuid.UUID, voucher_id: uuid.UUID, payload: VoucherUpdate) -> VoucherOut:
        v = self.get_voucher(tenant_id, voucher_id)
        if v.status != VoucherStatus.DRAFT:
            raise ConflictError("Posted vouchers cannot be edited; reverse them instead")
        data = payload.model_dump(exclude_unset=True, exclude={"lines"})
        for field, value in data.items():
            if value is not None or field != "voucher_date":
                setattr(v, field, value)
        if payload.lines is not None:
            v.lines = self._build_lines(tenant_id, payload.lines)
        self.db.commit()
        return self.voucher_out(tenant_id, self.get_voucher(tenant_id, v.id))

    def delete_voucher(self, tenant_id: uuid.UUID, voucher_id: uuid.UUID) -> None:
        v = self.get_voucher(tenant_id, voucher_id)
        if v.status != VoucherStatus.DRAFT:
            raise ConflictError("Posted vouchers cannot be deleted; reverse them instead")
        self.db.delete(v)
        self.db.commit()

    def post_voucher(self, tenant_id: uuid.UUID, voucher_id: uuid.UUID) -> VoucherOut:
        v = self.get_voucher(tenant_id, voucher_id)
        if v.status == VoucherStatus.POSTED:
            raise ConflictError("Voucher is already posted")
        self._ensure_open(tenant_id, v.voucher_date)
        # re-validate balance against the stored lines
        dr = sum((_d(l.debit) for l in v.lines), Decimal(0))
        cr = sum((_d(l.credit) for l in v.lines), Decimal(0))
        if dr != cr or len(v.lines) < 2:
            raise UnprocessableError("Voucher is not balanced")
        v.status = VoucherStatus.POSTED
        v.posted_at = datetime.now(timezone.utc)
        self.db.commit()
        return self.voucher_out(tenant_id, self.get_voucher(tenant_id, v.id))

    def reverse_voucher(self, tenant_id: uuid.UUID, user_id: uuid.UUID, voucher_id: uuid.UUID,
                        payload: VoucherReverseRequest) -> VoucherOut:
        original = self.get_voucher(tenant_id, voucher_id)
        if original.status != VoucherStatus.POSTED:
            raise ConflictError("Only posted vouchers can be reversed")
        if original.reversed_by_id is not None:
            raise ConflictError("Voucher has already been reversed")
        if original.reversal_of_id is not None:
            raise ConflictError("A reversal voucher cannot itself be reversed")
        lines = [
            VoucherLineIn(account_id=l.account_id, debit=float(l.credit), credit=float(l.debit),
                          description=l.description)
            for l in original.lines
        ]
        reversal = self._create_voucher(
            tenant_id, user_id,
            voucher_type=VoucherType.JV,
            voucher_date=payload.reversal_date or date.today(),
            lines=lines,
            narration=payload.narration or f"Reversal of {original.voucher_number}",
            reference=original.voucher_number,
            post=True,
            source="reversal",
            reversal_of_id=original.id,
        )
        original.reversed_by_id = reversal.id
        self.db.commit()
        return self.voucher_out(tenant_id, self.get_voucher(tenant_id, reversal.id))

    def list_vouchers(self, tenant_id: uuid.UUID, **filters) -> list[VoucherOut]:
        vouchers = self.vouchers.search(tenant_id, **filters)
        names = self._account_names(tenant_id)
        return [self._voucher_out(v, names) for v in vouchers]

    def voucher_out(self, tenant_id: uuid.UUID, v: Voucher) -> VoucherOut:
        return self._voucher_out(v, self._account_names(tenant_id))

    def _account_names(self, tenant_id: uuid.UUID) -> dict[uuid.UUID, tuple[str, str]]:
        return {a.id: (a.code, a.name) for a in self.accounts.list(tenant_id)}

    @staticmethod
    def _voucher_out(v: Voucher, names: dict[uuid.UUID, tuple[str, str]]) -> VoucherOut:
        lines = []
        for l in v.lines:
            code, name = names.get(l.account_id, (None, None))
            lines.append(
                VoucherLineOut(
                    id=l.id, account_id=l.account_id, account_code=code, account_name=name,
                    debit=float(l.debit or 0), credit=float(l.credit or 0), description=l.description,
                )
            )
        return VoucherOut(
            id=v.id, voucher_type=v.voucher_type, voucher_number=v.voucher_number, voucher_date=v.voucher_date,
            narration=v.narration, reference=v.reference, payee=v.payee, attachment_url=v.attachment_url,
            status=v.status, source=v.source, reversal_of_id=v.reversal_of_id, reversed_by_id=v.reversed_by_id,
            posted_at=v.posted_at,
            total_debit=_f(sum((_d(l.debit) for l in v.lines), Decimal(0))),
            total_credit=_f(sum((_d(l.credit) for l in v.lines), Decimal(0))),
            lines=lines,
        )

    # ================= Quick income / expense =================
    def quick_entry(self, tenant_id: uuid.UUID, user_id: uuid.UUID, payload: QuickEntryCreate) -> VoucherOut:
        head = self.get_account(tenant_id, payload.head_account_id)
        cash_bank = self.get_account(tenant_id, payload.cash_bank_account_id)
        if cash_bank.subtype not in ("cash", "bank"):
            raise UnprocessableError("Paid from / received in must be a cash or bank account")
        is_cash = cash_bank.subtype == "cash"
        if payload.entry_type == "expense":
            if head.account_type not in (AccountType.EXPENSE, AccountType.ASSET, AccountType.LIABILITY):
                raise UnprocessableError("Expense head must be an expense, asset or liability account")
            vtype = VoucherType.CPV if is_cash else VoucherType.BPV
            lines = [
                VoucherLineIn(account_id=head.id, debit=payload.amount, description=payload.description),
                VoucherLineIn(account_id=cash_bank.id, credit=payload.amount, description=payload.payee),
            ]
        else:
            if head.account_type not in (AccountType.INCOME, AccountType.LIABILITY, AccountType.EQUITY):
                raise UnprocessableError("Income head must be an income, liability or equity account")
            vtype = VoucherType.CRV if is_cash else VoucherType.BRV
            lines = [
                VoucherLineIn(account_id=cash_bank.id, debit=payload.amount, description=payload.payee),
                VoucherLineIn(account_id=head.id, credit=payload.amount, description=payload.description),
            ]
        v = self._create_voucher(
            tenant_id, user_id, voucher_type=vtype, voucher_date=payload.entry_date, lines=lines,
            narration=payload.description or f"{payload.entry_type.title()}: {head.name}",
            reference=payload.reference, payee=payload.payee, attachment_url=payload.attachment_url,
            post=True, source="quick",
        )
        self.db.commit()
        return self.voucher_out(tenant_id, self.get_voucher(tenant_id, v.id))

    # ================= Sync from fees & payouts =================
    def _pending_payments(self, tenant_id: uuid.UUID) -> list[Payment]:
        linked = self.links.linked_ids(tenant_id, SOURCE_FEE_PAYMENT)
        stmt = select(Payment).where(
            Payment.tenant_id == tenant_id, Payment.verification_status == PaymentVerificationStatus.VERIFIED
        )
        return [p for p in self.db.execute(stmt).scalars().all() if p.id not in linked]

    def _pending_payouts(self, tenant_id: uuid.UUID) -> list[TeacherPayout]:
        linked = self.links.linked_ids(tenant_id, SOURCE_TEACHER_PAYOUT)
        stmt = select(TeacherPayout).where(
            TeacherPayout.tenant_id == tenant_id, TeacherPayout.status == PayoutStatus.PAID
        )
        return [p for p in self.db.execute(stmt).scalars().all() if p.id not in linked]

    def sync_status(self, tenant_id: uuid.UUID) -> SyncStatus:
        return SyncStatus(
            pending_fee_payments=len(self._pending_payments(tenant_id)),
            pending_payouts=len(self._pending_payouts(tenant_id)),
        )

    def sync(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> SyncResult:
        self.seed_default_chart(tenant_id, commit=False)
        code = {a.code: a for a in self.accounts.list(tenant_id)}
        fee_count = payout_count = skipped = 0

        for p in self._pending_payments(tenant_id):
            when = (p.verified_at or p.submitted_at or datetime.now(timezone.utc)).date()
            if self.is_period_closed(tenant_id, when):
                skipped += 1
                continue
            invoice = self.db.get(Invoice, p.invoice_id)
            income = code[CODE_FEE_INCOME.get(invoice.invoice_type if invoice else InvoiceType.TUITION, "4100")]
            is_cash = p.payment_method == PaymentMethod.CASH
            money = code[CODE_CASH if is_cash else CODE_BANK]
            ref = invoice.invoice_number if invoice else None
            v = self._create_voucher(
                tenant_id, user_id,
                voucher_type=VoucherType.CRV if is_cash else VoucherType.BRV,
                voucher_date=when,
                lines=[
                    VoucherLineIn(account_id=money.id, debit=float(p.amount)),
                    VoucherLineIn(account_id=income.id, credit=float(p.amount)),
                ],
                narration=f"Fee collection{' - invoice ' + ref if ref else ''} ({p.payment_method.value})",
                reference=ref, post=True, source="sync",
            )
            self.links.create(AccountingSourceLink(
                tenant_id=tenant_id, source_type=SOURCE_FEE_PAYMENT, source_id=p.id, voucher_id=v.id))
            fee_count += 1

        for po in self._pending_payouts(tenant_id):
            if po.paid_at:
                when = po.paid_at.date()
            else:
                when = date(po.period_year, po.period_month, calendar.monthrange(po.period_year, po.period_month)[1])
            if self.is_period_closed(tenant_id, when):
                skipped += 1
                continue
            teacher_name = self.db.execute(
                select(User.full_name).join(TeacherProfile, TeacherProfile.user_id == User.id)
                .where(TeacherProfile.id == po.teacher_id)
            ).scalar_one_or_none()
            v = self._create_voucher(
                tenant_id, user_id,
                voucher_type=VoucherType.BPV,
                voucher_date=when,
                lines=[
                    VoucherLineIn(account_id=code[CODE_PAYOUT_EXPENSE].id, debit=float(po.calculated_amount)),
                    VoucherLineIn(account_id=code[CODE_BANK].id, credit=float(po.calculated_amount)),
                ],
                narration=f"Teacher payout {po.period_month:02d}/{po.period_year}",
                payee=teacher_name, post=True, source="sync",
            )
            self.links.create(AccountingSourceLink(
                tenant_id=tenant_id, source_type=SOURCE_TEACHER_PAYOUT, source_id=po.id, voucher_id=v.id))
            payout_count += 1

        self.db.commit()
        return SyncResult(fee_vouchers_created=fee_count, payout_vouchers_created=payout_count,
                          skipped_closed_period=skipped)

    # ================= Reports =================
    def _account_totals(self, tenant_id: uuid.UUID, date_from: date | None = None, date_to: date | None = None,
                        before: date | None = None) -> dict[uuid.UUID, tuple[Decimal, Decimal]]:
        totals: dict[uuid.UUID, list[Decimal]] = defaultdict(lambda: [Decimal(0), Decimal(0)])
        for line, _ in self.vouchers.posted_lines(tenant_id, date_from=date_from, date_to=date_to, before=before):
            totals[line.account_id][0] += _d(line.debit)
            totals[line.account_id][1] += _d(line.credit)
        return {k: (v[0], v[1]) for k, v in totals.items()}

    def ledger(self, tenant_id: uuid.UUID, account_id: uuid.UUID, date_from: date | None,
               date_to: date | None) -> LedgerReport:
        acc = self.get_account(tenant_id, account_id)
        opening = Decimal(0)
        if date_from:
            for line, _ in self.vouchers.posted_lines(tenant_id, account_id=acc.id, before=date_from):
                opening += _signed(acc.account_type, _d(line.debit), _d(line.credit))
        running = opening
        total_dr = total_cr = Decimal(0)
        entries = []
        for line, v in self.vouchers.posted_lines(tenant_id, date_from=date_from, date_to=date_to,
                                                  account_id=acc.id):
            dr, cr = _d(line.debit), _d(line.credit)
            total_dr += dr
            total_cr += cr
            running += _signed(acc.account_type, dr, cr)
            entries.append(LedgerEntry(
                entry_date=v.voucher_date, voucher_id=v.id, voucher_number=v.voucher_number,
                voucher_type=v.voucher_type, narration=v.narration, description=line.description,
                debit=_f(dr), credit=_f(cr), balance=_f(running),
            ))
        return LedgerReport(
            account_id=acc.id, account_code=acc.code, account_name=acc.name, account_type=acc.account_type,
            date_from=date_from, date_to=date_to, opening_balance=_f(opening), total_debit=_f(total_dr),
            total_credit=_f(total_cr), closing_balance=_f(running), entries=entries,
        )

    def cash_book(self, tenant_id: uuid.UUID, account_id: uuid.UUID | None, date_from: date | None,
                  date_to: date | None) -> LedgerReport:
        if account_id is None:
            cash = self.accounts.get_by_code(tenant_id, CODE_CASH)
            if cash is None:
                cash = next((a for a in self.accounts.list_ordered(tenant_id) if a.subtype == "cash"), None)
            if cash is None:
                raise NotFoundError("No cash account found; seed the default chart of accounts first")
            account_id = cash.id
        return self.ledger(tenant_id, account_id, date_from, date_to)

    def day_book(self, tenant_id: uuid.UUID, date_from: date | None, date_to: date | None) -> DayBookReport:
        vouchers = self.list_vouchers(tenant_id, status=VoucherStatus.POSTED, date_from=date_from, date_to=date_to)
        vouchers.sort(key=lambda v: (v.voucher_date, v.voucher_number))
        return DayBookReport(
            date_from=date_from, date_to=date_to, vouchers=vouchers,
            total_debit=round(sum(v.total_debit for v in vouchers), 2),
            total_credit=round(sum(v.total_credit for v in vouchers), 2),
        )

    def trial_balance(self, tenant_id: uuid.UUID, as_of: date | None) -> TrialBalanceReport:
        totals = self._account_totals(tenant_id, date_to=as_of)
        rows = []
        sum_dr = sum_cr = Decimal(0)
        for acc in self.accounts.list_ordered(tenant_id):
            if acc.id not in totals:
                continue
            dr, cr = totals[acc.id]
            net = dr - cr
            debit_bal = net if net > 0 else Decimal(0)
            credit_bal = -net if net < 0 else Decimal(0)
            sum_dr += debit_bal
            sum_cr += credit_bal
            rows.append(TrialBalanceRow(
                account_id=acc.id, code=acc.code, name=acc.name, account_type=acc.account_type,
                total_debit=_f(dr), total_credit=_f(cr), debit_balance=_f(debit_bal), credit_balance=_f(credit_bal),
            ))
        return TrialBalanceReport(as_of=as_of, rows=rows, total_debit=_f(sum_dr), total_credit=_f(sum_cr),
                                  is_balanced=sum_dr == sum_cr)

    def _rows_for(self, accounts: list[Account], totals, account_type: AccountType) -> tuple[list[StatementRow], Decimal]:
        rows, total = [], Decimal(0)
        for acc in accounts:
            if acc.account_type != account_type or acc.id not in totals:
                continue
            dr, cr = totals[acc.id]
            amount = _signed(account_type, dr, cr)
            if amount == 0:
                continue
            total += amount
            rows.append(StatementRow(account_id=acc.id, code=acc.code, name=acc.name, amount=_f(amount)))
        return rows, total

    def income_statement(self, tenant_id: uuid.UUID, date_from: date | None,
                         date_to: date | None) -> IncomeStatementReport:
        totals = self._account_totals(tenant_id, date_from=date_from, date_to=date_to)
        accounts = self.accounts.list_ordered(tenant_id)
        income, total_income = self._rows_for(accounts, totals, AccountType.INCOME)
        expenses, total_exp = self._rows_for(accounts, totals, AccountType.EXPENSE)
        return IncomeStatementReport(
            date_from=date_from, date_to=date_to, income=income, expenses=expenses,
            total_income=_f(total_income), total_expenses=_f(total_exp), net_profit=_f(total_income - total_exp),
        )

    def balance_sheet(self, tenant_id: uuid.UUID, as_of: date | None) -> BalanceSheetReport:
        as_of = as_of or date.today()
        totals = self._account_totals(tenant_id, date_to=as_of)
        accounts = self.accounts.list_ordered(tenant_id)
        assets, total_assets = self._rows_for(accounts, totals, AccountType.ASSET)
        liabilities, total_liab = self._rows_for(accounts, totals, AccountType.LIABILITY)
        equity, total_equity = self._rows_for(accounts, totals, AccountType.EQUITY)
        _, inc = self._rows_for(accounts, totals, AccountType.INCOME)
        _, exp = self._rows_for(accounts, totals, AccountType.EXPENSE)
        earnings = inc - exp
        if earnings != 0:
            equity.append(StatementRow(account_id=None, code="", name="Current / Retained Earnings (P&L)",
                                       amount=_f(earnings)))
            total_equity += earnings
        return BalanceSheetReport(
            as_of=as_of, assets=assets, liabilities=liabilities, equity=equity,
            total_assets=_f(total_assets), total_liabilities=_f(total_liab), total_equity=_f(total_equity),
            total_liabilities_and_equity=_f(total_liab + total_equity),
            is_balanced=total_assets == total_liab + total_equity,
        )

    def monthly_series(self, tenant_id: uuid.UUID, year: int) -> list[MonthlyPoint]:
        types = {a.id: a.account_type for a in self.accounts.list(tenant_id)}
        inc = defaultdict(lambda: Decimal(0))
        exp = defaultdict(lambda: Decimal(0))
        for line, v in self.vouchers.posted_lines(tenant_id, date_from=date(year, 1, 1), date_to=date(year, 12, 31)):
            t = types.get(line.account_id)
            if t == AccountType.INCOME:
                inc[v.voucher_date.month] += _d(line.credit) - _d(line.debit)
            elif t == AccountType.EXPENSE:
                exp[v.voucher_date.month] += _d(line.debit) - _d(line.credit)
        return [
            MonthlyPoint(year=year, month=m, income=_f(inc[m]), expense=_f(exp[m]), net=_f(inc[m] - exp[m]))
            for m in range(1, 13)
        ]
