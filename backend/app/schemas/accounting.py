import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.accounting import AccountType, PeriodStatus, VoucherStatus, VoucherType


# ---------- Chart of accounts ----------
class AccountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=150)
    account_type: AccountType
    parent_id: uuid.UUID | None = None
    subtype: str | None = Field(default=None, pattern="^(cash|bank)$")
    description: str | None = None
    is_active: bool = True


class AccountUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=150)
    parent_id: uuid.UUID | None = None
    subtype: str | None = Field(default=None, pattern="^(cash|bank)$")
    description: str | None = None
    is_active: bool | None = None


class AccountOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    account_type: AccountType
    parent_id: uuid.UUID | None
    subtype: str | None
    description: str | None
    is_active: bool
    is_system: bool
    balance: float = 0.0

    model_config = {"from_attributes": True}


class SeedResult(BaseModel):
    created: int
    total: int


# ---------- Vouchers ----------
class VoucherLineIn(BaseModel):
    account_id: uuid.UUID
    debit: float = Field(default=0, ge=0)
    credit: float = Field(default=0, ge=0)
    description: str | None = Field(default=None, max_length=255)


class VoucherCreate(BaseModel):
    voucher_type: VoucherType
    voucher_date: date
    narration: str | None = Field(default=None, max_length=500)
    reference: str | None = Field(default=None, max_length=100)
    payee: str | None = Field(default=None, max_length=150)
    attachment_url: str | None = Field(default=None, max_length=500)
    lines: list[VoucherLineIn] = Field(min_length=2)
    post: bool = False


class VoucherUpdate(BaseModel):
    voucher_date: date | None = None
    narration: str | None = None
    reference: str | None = None
    payee: str | None = None
    attachment_url: str | None = None
    lines: list[VoucherLineIn] | None = Field(default=None, min_length=2)


class VoucherReverseRequest(BaseModel):
    reversal_date: date | None = None
    narration: str | None = None


class VoucherLineOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    account_code: str | None = None
    account_name: str | None = None
    debit: float
    credit: float
    description: str | None

    model_config = {"from_attributes": True}


class VoucherOut(BaseModel):
    id: uuid.UUID
    voucher_type: VoucherType
    voucher_number: str
    voucher_date: date
    narration: str | None
    reference: str | None
    payee: str | None
    attachment_url: str | None
    status: VoucherStatus
    source: str
    reversal_of_id: uuid.UUID | None
    reversed_by_id: uuid.UUID | None
    posted_at: datetime | None
    total_debit: float
    total_credit: float
    lines: list[VoucherLineOut]


# ---------- Quick income / expense ----------
class QuickEntryCreate(BaseModel):
    entry_type: str = Field(pattern="^(income|expense)$")
    head_account_id: uuid.UUID
    cash_bank_account_id: uuid.UUID
    amount: float = Field(gt=0)
    entry_date: date
    payee: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    attachment_url: str | None = Field(default=None, max_length=500)
    reference: str | None = Field(default=None, max_length=100)


# ---------- Periods ----------
class PeriodRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)


class PeriodOut(BaseModel):
    year: int
    month: int
    status: PeriodStatus
    closed_at: datetime | None = None


# ---------- Sync ----------
class SyncResult(BaseModel):
    fee_vouchers_created: int
    payout_vouchers_created: int
    skipped_closed_period: int


class SyncStatus(BaseModel):
    pending_fee_payments: int
    pending_payouts: int


# ---------- Reports ----------
class LedgerEntry(BaseModel):
    entry_date: date
    voucher_id: uuid.UUID
    voucher_number: str
    voucher_type: VoucherType
    narration: str | None
    description: str | None
    debit: float
    credit: float
    balance: float


class LedgerReport(BaseModel):
    account_id: uuid.UUID
    account_code: str
    account_name: str
    account_type: AccountType
    date_from: date | None
    date_to: date | None
    opening_balance: float
    total_debit: float
    total_credit: float
    closing_balance: float
    entries: list[LedgerEntry]


class TrialBalanceRow(BaseModel):
    account_id: uuid.UUID
    code: str
    name: str
    account_type: AccountType
    total_debit: float
    total_credit: float
    debit_balance: float
    credit_balance: float


class TrialBalanceReport(BaseModel):
    as_of: date | None
    rows: list[TrialBalanceRow]
    total_debit: float
    total_credit: float
    is_balanced: bool


class StatementRow(BaseModel):
    account_id: uuid.UUID | None
    code: str
    name: str
    amount: float


class IncomeStatementReport(BaseModel):
    date_from: date | None
    date_to: date | None
    income: list[StatementRow]
    expenses: list[StatementRow]
    total_income: float
    total_expenses: float
    net_profit: float


class BalanceSheetReport(BaseModel):
    as_of: date
    assets: list[StatementRow]
    liabilities: list[StatementRow]
    equity: list[StatementRow]
    total_assets: float
    total_liabilities: float
    total_equity: float
    total_liabilities_and_equity: float
    is_balanced: bool


class DayBookReport(BaseModel):
    date_from: date | None
    date_to: date | None
    vouchers: list[VoucherOut]
    total_debit: float
    total_credit: float


class MonthlyPoint(BaseModel):
    year: int
    month: int
    income: float
    expense: float
    net: float
