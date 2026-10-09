import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.accounting import PeriodStatus, VoucherStatus, VoucherType
from app.models.tenant import Tenant
from app.models.user import RoleEnum, User
from app.schemas.accounting import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    BalanceSheetReport,
    DayBookReport,
    IncomeStatementReport,
    LedgerReport,
    MonthlyPoint,
    PeriodOut,
    PeriodRequest,
    QuickEntryCreate,
    SeedResult,
    SyncResult,
    SyncStatus,
    TrialBalanceReport,
    VoucherCreate,
    VoucherOut,
    VoucherReverseRequest,
    VoucherUpdate,
)
from app.services.accounting_service import AccountingService
from app.services.finance_pdf import render_voucher

router = APIRouter(prefix="/accounting", tags=["accounting"])
admin_only = require_role(RoleEnum.ADMIN)


# ---------- Chart of accounts ----------
@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(
    active_only: bool = Query(default=False),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> list[AccountOut]:
    return AccountingService(db).list_accounts(current_user.tenant_id, active_only)


@router.post("/accounts", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).create_account(current_user.tenant_id, payload)


@router.post("/accounts/seed-defaults", response_model=SeedResult)
def seed_accounts(current_user: User = Depends(admin_only), db: Session = Depends(get_db)) -> SeedResult:
    return AccountingService(db).seed_default_chart(current_user.tenant_id)


@router.patch("/accounts/{account_id}", response_model=AccountOut)
def update_account(
    account_id: uuid.UUID, payload: AccountUpdate, current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).update_account(current_user.tenant_id, account_id, payload)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    AccountingService(db).delete_account(current_user.tenant_id, account_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Vouchers ----------
@router.get("/vouchers", response_model=list[VoucherOut])
def list_vouchers(
    voucher_type: VoucherType | None = Query(default=None),
    status_filter: VoucherStatus | None = Query(default=None, alias="status"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    source: str | None = Query(default=None),
    q: str | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> list[VoucherOut]:
    return AccountingService(db).list_vouchers(
        current_user.tenant_id, voucher_type=voucher_type, status=status_filter, date_from=date_from,
        date_to=date_to, source=source, query=q,
    )


@router.post("/vouchers", response_model=VoucherOut, status_code=status.HTTP_201_CREATED)
def create_voucher(payload: VoucherCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).create_voucher(current_user.tenant_id, current_user.id, payload)


@router.get("/vouchers/{voucher_id}", response_model=VoucherOut)
def get_voucher(voucher_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    svc = AccountingService(db)
    return svc.voucher_out(current_user.tenant_id, svc.get_voucher(current_user.tenant_id, voucher_id))


@router.patch("/vouchers/{voucher_id}", response_model=VoucherOut)
def update_voucher(
    voucher_id: uuid.UUID, payload: VoucherUpdate, current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).update_voucher(current_user.tenant_id, voucher_id, payload)


@router.delete("/vouchers/{voucher_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_voucher(voucher_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    AccountingService(db).delete_voucher(current_user.tenant_id, voucher_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/vouchers/{voucher_id}/post", response_model=VoucherOut)
def post_voucher(voucher_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).post_voucher(current_user.tenant_id, voucher_id)


@router.post("/vouchers/{voucher_id}/reverse", response_model=VoucherOut, status_code=status.HTTP_201_CREATED)
def reverse_voucher(
    voucher_id: uuid.UUID,
    payload: VoucherReverseRequest | None = None,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).reverse_voucher(
        current_user.tenant_id, current_user.id, voucher_id, payload or VoucherReverseRequest()
    )


@router.get("/vouchers/{voucher_id}/pdf")
def voucher_pdf(voucher_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    svc = AccountingService(db)
    out = svc.voucher_out(current_user.tenant_id, svc.get_voucher(current_user.tenant_id, voucher_id))
    tenant = db.get(Tenant, current_user.tenant_id)
    data = out.model_dump(mode="json")
    pdf = render_voucher(tenant_name=tenant.name if tenant else "School", voucher=data)
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{out.voucher_number}.pdf"'},
    )


# ---------- Quick income / expense ----------
@router.post("/quick-entries", response_model=VoucherOut, status_code=status.HTTP_201_CREATED)
def quick_entry(payload: QuickEntryCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).quick_entry(current_user.tenant_id, current_user.id, payload)


@router.get("/quick-entries", response_model=list[VoucherOut])
def list_quick_entries(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).list_vouchers(
        current_user.tenant_id, source="quick", date_from=date_from, date_to=date_to
    )


# ---------- Periods ----------
@router.get("/periods", response_model=list[PeriodOut])
def list_periods(year: int = Query(...), current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).list_periods(current_user.tenant_id, year)


@router.post("/periods/close", response_model=PeriodOut)
def close_period(payload: PeriodRequest, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).set_period_status(
        current_user.tenant_id, current_user.id, payload.year, payload.month, PeriodStatus.CLOSED
    )


@router.post("/periods/reopen", response_model=PeriodOut)
def reopen_period(payload: PeriodRequest, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).set_period_status(
        current_user.tenant_id, current_user.id, payload.year, payload.month, PeriodStatus.OPEN
    )


# ---------- Sync ----------
@router.get("/sync/status", response_model=SyncStatus)
def sync_status(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).sync_status(current_user.tenant_id)


@router.post("/sync", response_model=SyncResult)
def sync(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).sync(current_user.tenant_id, current_user.id)


# ---------- Reports ----------
@router.get("/reports/ledger", response_model=LedgerReport)
def ledger(
    account_id: uuid.UUID = Query(...),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).ledger(current_user.tenant_id, account_id, date_from, date_to)


@router.get("/reports/cash-book", response_model=LedgerReport)
def cash_book(
    account_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).cash_book(current_user.tenant_id, account_id, date_from, date_to)


@router.get("/reports/day-book", response_model=DayBookReport)
def day_book(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).day_book(current_user.tenant_id, date_from, date_to)


@router.get("/reports/trial-balance", response_model=TrialBalanceReport)
def trial_balance(
    as_of: date | None = Query(default=None), current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).trial_balance(current_user.tenant_id, as_of)


@router.get("/reports/income-statement", response_model=IncomeStatementReport)
def income_statement(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).income_statement(current_user.tenant_id, date_from, date_to)


@router.get("/reports/balance-sheet", response_model=BalanceSheetReport)
def balance_sheet(
    as_of: date | None = Query(default=None), current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return AccountingService(db).balance_sheet(current_user.tenant_id, as_of)


@router.get("/reports/monthly", response_model=list[MonthlyPoint])
def monthly(year: int = Query(...), current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return AccountingService(db).monthly_series(current_user.tenant_id, year)
