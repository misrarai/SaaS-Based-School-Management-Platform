import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import DomainError, ForbiddenError
from app.db.session import get_db
from app.models.fee import PaymentMethod
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.fee_collection import (
    ClassCollectionSummary,
    CollectRequest,
    ConcessionCreate,
    ConcessionOut,
    ConcessionUpdate,
    CounterAccountOut,
    CounterSearchResult,
    DailyCollectionReport,
    DefaulterRow,
    FeeHeadCreate,
    FeeHeadOut,
    FeeHeadUpdate,
    FeeStructureOut,
    FeeStructureSet,
    GenerateStructuredInvoicesRequest,
    GenerateStructuredInvoicesResult,
    InvoiceLineOut,
    InvoiceSummaryOut,
    ItemizedInvoiceCreate,
    LateFeeRuleIn,
    LateFeeRuleOut,
    LedgerOut,
    ReceiptOut,
    ReminderRequest,
    ReminderResult,
)
from app.services.fee_collection_service import FeeCollectionService
from app.services.parent_service import ParentService

router = APIRouter(prefix="/fee-collection", tags=["fee-collection"])

ADMIN = require_role(RoleEnum.ADMIN)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _pdf(data: bytes, filename: str) -> Response:
    return Response(
        content=data, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={filename}"}
    )


def _own_student_ids(db: Session, user: User) -> set[uuid.UUID]:
    """Student ids a parent/student user may see fee documents for."""
    if user.role == RoleEnum.PARENT:
        return {c.id for c in ParentService(db).list_children_profiles(user.tenant_id, user.id)}
    if user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(user.tenant_id, user.id)
        return {profile.id} if profile else set()
    return set()


# ---------------------------------------------------------------- fee heads


@router.get("/heads", response_model=list[FeeHeadOut])
def list_heads(
    active_only: bool = Query(default=False),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return FeeCollectionService(db).list_heads(current_user.tenant_id, active_only)


@router.post("/heads", response_model=FeeHeadOut, status_code=status.HTTP_201_CREATED)
def create_head(payload: FeeHeadCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return FeeCollectionService(db).create_head(current_user.tenant_id, payload)


@router.post("/heads/seed-defaults", response_model=list[FeeHeadOut])
def seed_default_heads(current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return FeeCollectionService(db).seed_default_heads(current_user.tenant_id)


@router.patch("/heads/{head_id}", response_model=FeeHeadOut)
def update_head(
    head_id: uuid.UUID, payload: FeeHeadUpdate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return FeeCollectionService(db).update_head(current_user.tenant_id, head_id, payload)


@router.delete("/heads/{head_id}")
def delete_head(head_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)) -> dict:
    return {"result": FeeCollectionService(db).delete_head(current_user.tenant_id, head_id)}


# ---------------------------------------------------------------- structure


@router.get("/structure/{class_grade_id}", response_model=FeeStructureOut)
def get_structure(class_grade_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return FeeCollectionService(db).get_structure(current_user.tenant_id, class_grade_id)


@router.put("/structure/{class_grade_id}", response_model=FeeStructureOut)
def set_structure(
    class_grade_id: uuid.UUID,
    payload: FeeStructureSet,
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return FeeCollectionService(db).set_structure(current_user.tenant_id, class_grade_id, payload)


# ---------------------------------------------------------------- concessions / late fee


@router.get("/concessions", response_model=list[ConcessionOut])
def list_concessions(
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return FeeCollectionService(db).list_concessions(current_user.tenant_id, student_id)


@router.post("/concessions", response_model=ConcessionOut, status_code=status.HTTP_201_CREATED)
def create_concession(payload: ConcessionCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return FeeCollectionService(db).create_concession(current_user.tenant_id, payload)


@router.patch("/concessions/{concession_id}", response_model=ConcessionOut)
def update_concession(
    concession_id: uuid.UUID,
    payload: ConcessionUpdate,
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return FeeCollectionService(db).update_concession(current_user.tenant_id, concession_id, payload)


@router.delete("/concessions/{concession_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_concession(concession_id: uuid.UUID, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    FeeCollectionService(db).delete_concession(current_user.tenant_id, concession_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/late-fee-rule", response_model=LateFeeRuleOut)
def get_late_fee_rule(current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return FeeCollectionService(db).get_late_fee_rule(current_user.tenant_id)


@router.put("/late-fee-rule", response_model=LateFeeRuleOut)
def set_late_fee_rule(payload: LateFeeRuleIn, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return FeeCollectionService(db).set_late_fee_rule(current_user.tenant_id, payload)


# ---------------------------------------------------------------- invoices & vouchers


@router.post("/invoices/generate", response_model=GenerateStructuredInvoicesResult, status_code=status.HTTP_201_CREATED)
def generate_structured_invoices(
    payload: GenerateStructuredInvoicesRequest, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return FeeCollectionService(db).generate_structured_invoices(current_user.tenant_id, payload)


@router.post("/invoices", response_model=InvoiceSummaryOut, status_code=status.HTTP_201_CREATED)
def create_itemized_invoice(
    payload: ItemizedInvoiceCreate, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)
):
    return FeeCollectionService(db).create_itemized_invoice(current_user.tenant_id, payload)


@router.get("/invoices", response_model=list[InvoiceSummaryOut])
def list_invoices(
    class_grade_id: uuid.UUID | None = Query(default=None),
    period_month: int | None = Query(default=None, ge=1, le=12),
    period_year: int | None = Query(default=None, ge=2000, le=2100),
    open_only: bool = Query(default=False),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT, RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
):
    """Invoice list with balances. Parents/students only ever see their own children's/own."""
    service = FeeCollectionService(db)
    if current_user.role == RoleEnum.ADMIN:
        return service.list_invoice_summaries(
            current_user.tenant_id, class_grade_id, None, period_month, period_year, open_only
        )
    own = list(_own_student_ids(db, current_user))
    if not own:
        return []
    return service.list_invoice_summaries(current_user.tenant_id, None, own, period_month, period_year, open_only)


@router.get("/invoices/{invoice_id}/lines", response_model=list[InvoiceLineOut])
def get_invoice_lines(
    invoice_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT, RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
):
    service = FeeCollectionService(db)
    invoice = service.fee.get_invoice_or_404(current_user.tenant_id, invoice_id)
    if current_user.role != RoleEnum.ADMIN and invoice.student_id not in _own_student_ids(db, current_user):
        raise ForbiddenError("Not your invoice")
    return service.get_invoice_lines(current_user.tenant_id, invoice_id)


@router.get("/invoices/{invoice_id}/voucher.pdf")
def voucher_pdf(
    invoice_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT, RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> Response:
    service = FeeCollectionService(db)
    invoice = service.fee.get_invoice_or_404(current_user.tenant_id, invoice_id)
    if current_user.role != RoleEnum.ADMIN and invoice.student_id not in _own_student_ids(db, current_user):
        raise ForbiddenError("Not your invoice")
    data, filename = service.voucher_pdf(current_user.tenant_id, invoice_id)
    return _pdf(data, filename)


@router.get("/vouchers/bulk.pdf")
def bulk_vouchers_pdf(
    class_grade_id: uuid.UUID | None = Query(default=None),
    period_month: int | None = Query(default=None, ge=1, le=12),
    period_year: int | None = Query(default=None, ge=2000, le=2100),
    include_paid: bool = Query(default=False),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
) -> Response:
    data = FeeCollectionService(db).bulk_vouchers_pdf(
        current_user.tenant_id, class_grade_id, period_month, period_year, include_paid
    )
    return _pdf(data, "fee-vouchers.pdf")


# ---------------------------------------------------------------- counter


@router.get("/counter/search", response_model=list[CounterSearchResult])
def counter_search(q: str = Query(min_length=1), current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return FeeCollectionService(db).search_counter(current_user.tenant_id, q)


@router.get("/counter/account", response_model=CounterAccountOut)
def counter_account(
    family_id: uuid.UUID | None = Query(default=None),
    student_id: uuid.UUID | None = Query(default=None),
    on_date: date | None = Query(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    if family_id is None and student_id is None:
        raise DomainError("Provide family_id or student_id")
    return FeeCollectionService(db).get_counter_account(current_user.tenant_id, family_id, student_id, on_date)


@router.post("/counter/collect", response_model=ReceiptOut, status_code=status.HTTP_201_CREATED)
def counter_collect(payload: CollectRequest, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    return FeeCollectionService(db).collect(current_user.tenant_id, current_user, payload)


# ---------------------------------------------------------------- receipts


@router.get("/receipts", response_model=list[ReceiptOut])
def list_receipts(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    family_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return FeeCollectionService(db).list_receipts(current_user.tenant_id, date_from, date_to, family_id)


@router.get("/my/receipts", response_model=list[ReceiptOut])
def my_receipts(
    current_user: User = Depends(require_role(RoleEnum.PARENT, RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
):
    return FeeCollectionService(db).list_receipts_for_students(
        current_user.tenant_id, list(_own_student_ids(db, current_user))
    )


@router.get("/receipts/{receipt_id}", response_model=ReceiptOut)
def get_receipt(
    receipt_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT, RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
):
    service = FeeCollectionService(db)
    receipt = service.get_receipt_or_404(current_user.tenant_id, receipt_id)
    if current_user.role != RoleEnum.ADMIN:
        service.assert_receipt_visible(current_user.tenant_id, receipt, _own_student_ids(db, current_user))
    return service.receipt_out(current_user.tenant_id, receipt)


@router.get("/receipts/{receipt_id}/pdf")
def receipt_pdf(
    receipt_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT, RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> Response:
    service = FeeCollectionService(db)
    receipt = service.get_receipt_or_404(current_user.tenant_id, receipt_id)
    if current_user.role != RoleEnum.ADMIN:
        service.assert_receipt_visible(current_user.tenant_id, receipt, _own_student_ids(db, current_user))
    data, filename = service.receipt_pdf(current_user.tenant_id, receipt)
    return _pdf(data, filename)


# ---------------------------------------------------------------- defaulters


@router.get("/defaulters", response_model=list[DefaulterRow])
def list_defaulters(
    class_grade_id: uuid.UUID | None = Query(default=None),
    min_amount: float | None = Query(default=None, ge=0),
    months_overdue: int | None = Query(default=None, ge=0),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return FeeCollectionService(db).defaulters(current_user.tenant_id, class_grade_id, min_amount, months_overdue)


@router.get("/defaulters/export")
def export_defaulters(
    class_grade_id: uuid.UUID | None = Query(default=None),
    min_amount: float | None = Query(default=None, ge=0),
    months_overdue: int | None = Query(default=None, ge=0),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    service = FeeCollectionService(db)
    rows = service.defaulters(current_user.tenant_id, class_grade_id, min_amount, months_overdue)
    return StreamingResponse(
        io.BytesIO(service.defaulters_xlsx(rows)),
        media_type=XLSX,
        headers={"Content-Disposition": f"attachment; filename=fee-defaulters-{date.today().isoformat()}.xlsx"},
    )


@router.post("/defaulters/remind", response_model=ReminderResult)
def remind_defaulters(payload: ReminderRequest, current_user: User = Depends(ADMIN), db: Session = Depends(get_db)):
    service = FeeCollectionService(db)
    rows = service.defaulters(current_user.tenant_id, payload.class_grade_id, payload.min_amount, payload.months_overdue)
    if payload.student_ids:
        wanted = set(payload.student_ids)
        rows = [r for r in rows if r.student_id in wanted]
    return service.send_reminders(current_user.tenant_id, rows)


# ---------------------------------------------------------------- ledger


def _check_ledger_access(db: Session, user: User, service: FeeCollectionService, family_id, student_id) -> None:
    if family_id is None and student_id is None:
        raise DomainError("Provide family_id or student_id")
    if user.role == RoleEnum.ADMIN:
        return
    members = service.ledger_student_ids(user.tenant_id, family_id, student_id)
    if not (members & _own_student_ids(db, user)):
        raise ForbiddenError("Not your account")


@router.get("/ledger", response_model=LedgerOut)
def get_ledger(
    family_id: uuid.UUID | None = Query(default=None),
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
):
    service = FeeCollectionService(db)
    _check_ledger_access(db, current_user, service, family_id, student_id)
    return service.ledger(current_user.tenant_id, family_id, None if family_id else student_id)


@router.get("/ledger/pdf")
def get_ledger_pdf(
    family_id: uuid.UUID | None = Query(default=None),
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> Response:
    service = FeeCollectionService(db)
    _check_ledger_access(db, current_user, service, family_id, student_id)
    data = service.ledger_pdf(current_user.tenant_id, family_id, None if family_id else student_id)
    return _pdf(data, "fee-ledger.pdf")


# ---------------------------------------------------------------- reports


@router.get("/reports/daily-collection", response_model=DailyCollectionReport)
def daily_collection(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    payment_method: PaymentMethod | None = Query(default=None),
    collector_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    today = date.today()
    return FeeCollectionService(db).daily_collection(
        current_user.tenant_id,
        date_from or today,
        date_to or date_from or today,
        payment_method.value if payment_method else None,
        collector_id,
    )


@router.get("/reports/daily-collection/export")
def export_daily_collection(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    payment_method: PaymentMethod | None = Query(default=None),
    collector_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    today = date.today()
    service = FeeCollectionService(db)
    report = service.daily_collection(
        current_user.tenant_id,
        date_from or today,
        date_to or date_from or today,
        payment_method.value if payment_method else None,
        collector_id,
    )
    return StreamingResponse(
        io.BytesIO(service.daily_collection_xlsx(report)),
        media_type=XLSX,
        headers={"Content-Disposition": f"attachment; filename=collections-{report.date_from}-{report.date_to}.xlsx"},
    )


@router.get("/reports/class-summary", response_model=ClassCollectionSummary)
def class_summary(
    period_month: int | None = Query(default=None, ge=1, le=12),
    period_year: int | None = Query(default=None, ge=2000, le=2100),
    current_user: User = Depends(ADMIN),
    db: Session = Depends(get_db),
):
    return FeeCollectionService(db).class_summary(current_user.tenant_id, period_month, period_year)
