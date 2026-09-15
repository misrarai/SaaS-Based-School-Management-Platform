import io
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request, UploadFile, status
from fastapi.responses import RedirectResponse, StreamingResponse
from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import require_role
from app.core.exceptions import ForbiddenError
from app.db.session import get_db
from app.models.fee import InvoiceStatus, PaymentMethod, PaymentVerificationStatus
from app.models.payment_gateway import GatewayTransactionStatus
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.fee import (
    BulkGenerateInvoicesRequest,
    BulkGenerateInvoicesResult,
    FeePlanCreate,
    FeePlanOut,
    FeePlanUpdate,
    FeeReportSummary,
    GatewayTransactionOut,
    GenerateInvoicesRequest,
    InitiateGatewayPaymentResponse,
    InvoiceCreate,
    InvoiceOut,
    PaymentDetailOut,
    PaymentOut,
    PaymentVerifyRequest,
    SubscriptionEntry,
)
from app.services.fee_service import FeeService
from app.services.notification_service import NotificationService
from app.services.parent_service import ParentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fees", tags=["fees"])


@router.post("/plans", response_model=FeePlanOut, status_code=status.HTTP_201_CREATED)
def create_fee_plan(
    payload: FeePlanCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> FeePlanOut:
    return FeeService(db).set_fee_plan(current_user.tenant_id, payload)


@router.get("/plans", response_model=list[FeePlanOut])
def list_fee_plans(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[FeePlanOut]:
    return FeeService(db).list_fee_plans(current_user.tenant_id)


@router.patch("/plans/{plan_id}", response_model=FeePlanOut)
def update_fee_plan(
    plan_id: uuid.UUID,
    payload: FeePlanUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> FeePlanOut:
    return FeeService(db).update_fee_plan(current_user.tenant_id, plan_id, payload)


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: InvoiceCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> InvoiceOut:
    return FeeService(db).create_invoice(current_user.tenant_id, payload)


@router.post("/invoices/generate", response_model=list[InvoiceOut], status_code=status.HTTP_201_CREATED)
def generate_invoices(
    payload: GenerateInvoicesRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[InvoiceOut]:
    return FeeService(db).generate_monthly_invoices(current_user.tenant_id, payload)


@router.post("/invoices/bulk-generate", response_model=BulkGenerateInvoicesResult, status_code=status.HTTP_201_CREATED)
def bulk_generate_invoices(
    payload: BulkGenerateInvoicesRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> BulkGenerateInvoicesResult:
    return FeeService(db).bulk_generate_monthly_invoices(current_user.tenant_id, payload)


@router.post("/invoices/mark-overdue")
def mark_overdue_invoices(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> dict:
    count = FeeService(db).mark_overdue_invoices(current_user.tenant_id)
    return {"marked_overdue": count}


@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(
    class_grade_id: uuid.UUID | None = Query(default=None),
    status_filter: InvoiceStatus | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[InvoiceOut]:
    tenant_id = current_user.tenant_id
    service = FeeService(db)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return service.list_invoices(tenant_id, student_id=profile.id, status=status_filter)

    if current_user.role == RoleEnum.PARENT:
        children = ParentService(db).list_children_profiles(tenant_id, current_user.id)
        if not children:
            return []
        return service.list_invoices(tenant_id, student_ids=[c.id for c in children], status=status_filter)

    return service.list_invoices(tenant_id, class_grade_id=class_grade_id, status=status_filter)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> InvoiceOut:
    tenant_id = current_user.tenant_id
    service = FeeService(db)
    invoice = service.get_invoice_or_404(tenant_id, invoice_id)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None or profile.id != invoice.student_id:
            raise ForbiddenError("Not your invoice")
    elif current_user.role == RoleEnum.PARENT:
        ParentService(db).assert_child(tenant_id, current_user.id, invoice.student_id)

    return invoice


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def submit_payment(
    invoice_id: uuid.UUID,
    amount: float,
    payment_method: PaymentMethod,
    reference_note: str | None = None,
    receipt: UploadFile | None = None,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> PaymentOut:
    tenant_id = current_user.tenant_id
    service = FeeService(db)

    if current_user.role == RoleEnum.PARENT:
        invoice = service.get_invoice_or_404(tenant_id, invoice_id)
        ParentService(db).assert_child(tenant_id, current_user.id, invoice.student_id)

    return service.submit_payment(
        tenant_id, invoice_id, current_user.id, amount, payment_method, reference_note, receipt
    )


@router.post("/invoices/{invoice_id}/pay/jazzcash", response_model=InitiateGatewayPaymentResponse, status_code=status.HTTP_201_CREATED)
def initiate_jazzcash_payment(
    invoice_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> InitiateGatewayPaymentResponse:
    """Starts a JazzCash hosted-checkout payment for this invoice. The frontend takes the
    returned fields and auto-submits them as a POST form to checkout_url — the payer completes
    the payment on JazzCash's own page, which then redirects back to our public callback below."""
    tenant_id = current_user.tenant_id
    service = FeeService(db)

    if current_user.role == RoleEnum.PARENT:
        invoice = service.get_invoice_or_404(tenant_id, invoice_id)
        ParentService(db).assert_child(tenant_id, current_user.id, invoice.student_id)

    return service.initiate_jazzcash_payment(tenant_id, invoice_id, current_user.id)


@router.post("/gateway/jazzcash/callback", include_in_schema=False)
async def jazzcash_callback(request: Request, db: Session = Depends(get_db)) -> RedirectResponse:
    """Public endpoint — JazzCash's own servers/browser redirect POST here with the payment
    outcome, carrying no auth token of ours. Every field is treated as untrusted input until the
    secure hash is verified (see FeeService.handle_jazzcash_callback / JazzCashService); the
    result is then used to redirect the payer's browser back into the app with a plain status
    flag, never any gateway internals."""
    form = await request.form()
    fields = {k: str(v) for k, v in form.items()}

    service = FeeService(db)
    try:
        txn = service.handle_jazzcash_callback(fields)
    except Exception:
        logger.exception("JazzCash callback processing failed")
        return RedirectResponse(f"{settings.FRONTEND_URL}/parent/fees?jazzcash=error", status_code=status.HTTP_303_SEE_OTHER)

    if txn.status == GatewayTransactionStatus.COMPLETED:
        invoice = service.get_invoice_or_404(txn.tenant_id, txn.invoice_id)
        found = StudentProfileRepository(db).get_with_user(txn.tenant_id, invoice.student_id)
        if found is not None and txn.payment_id is not None:
            _, student_user = found
            NotificationService(db).notify_payment_verified(
                txn.tenant_id, invoice.student_id, student_user.full_name, float(txn.amount)
            )
        return RedirectResponse(f"{settings.FRONTEND_URL}/parent/fees?jazzcash=success", status_code=status.HTTP_303_SEE_OTHER)

    return RedirectResponse(f"{settings.FRONTEND_URL}/parent/fees?jazzcash=failed", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/invoices/{invoice_id}/gateway-transactions", response_model=list[GatewayTransactionOut])
def list_gateway_transactions(
    invoice_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[GatewayTransactionOut]:
    tenant_id = current_user.tenant_id
    service = FeeService(db)

    if current_user.role == RoleEnum.PARENT:
        invoice = service.get_invoice_or_404(tenant_id, invoice_id)
        ParentService(db).assert_child(tenant_id, current_user.id, invoice.student_id)

    return service.list_gateway_transactions(tenant_id, invoice_id)


@router.get("/payments", response_model=list[PaymentDetailOut])
def list_payments(
    status_filter: PaymentVerificationStatus | None = Query(default=None, alias="status"),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[PaymentDetailOut]:
    return FeeService(db).list_payments_detailed(current_user.tenant_id, status_filter)


@router.get("/payments/pending", response_model=list[PaymentDetailOut])
def list_pending_payments(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[PaymentDetailOut]:
    return FeeService(db).list_pending_payments_detailed(current_user.tenant_id)


@router.get("/subscriptions", response_model=list[SubscriptionEntry])
def list_subscriptions(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[SubscriptionEntry]:
    return FeeService(db).list_subscriptions(current_user.tenant_id)


@router.get("/reports/summary", response_model=FeeReportSummary)
def get_report_summary(
    period_month: int | None = Query(default=None, ge=1, le=12),
    period_year: int | None = Query(default=None, ge=2000, le=2100),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> FeeReportSummary:
    now = datetime.now(timezone.utc)
    return FeeService(db).get_report_summary(
        current_user.tenant_id, period_month or now.month, period_year or now.year
    )


@router.get("/reports/export")
def export_report_summary(
    period_month: int | None = Query(default=None, ge=1, le=12),
    period_year: int | None = Query(default=None, ge=2000, le=2100),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    now = datetime.now(timezone.utc)
    month = period_month or now.month
    year = period_year or now.year
    summary = FeeService(db).get_report_summary(current_user.tenant_id, month, year)

    wb = Workbook()
    ws = wb.active
    ws.title = "Fee Report"
    ws.append(["Fee Collection Report", f"{month:02d}/{year}"])
    ws.append([])
    ws.append(["Total Collected", summary.total_collected])
    ws.append(["Total Pending", summary.total_pending])
    ws.append(["Total Overdue", summary.total_overdue])
    ws.append([])
    ws.append(["Collected by payment method"])
    ws.append(["Method", "Amount"])
    for method, amount in summary.by_method.items():
        ws.append([method.replace("_", " ").title(), amount])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    filename = f"fee-report-{year}-{month:02d}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/payments/{payment_id}/verify", response_model=PaymentOut)
def verify_payment(
    payment_id: uuid.UUID,
    payload: PaymentVerifyRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> PaymentOut:
    tenant_id = current_user.tenant_id
    service = FeeService(db)
    payment = service.verify_payment(tenant_id, payment_id, current_user.id, payload.approve, payload.rejection_reason)

    if payload.approve:
        invoice = service.get_invoice_or_404(tenant_id, payment.invoice_id)
        found = StudentProfileRepository(db).get_with_user(tenant_id, invoice.student_id)
        if found is not None:
            _, student_user = found
            NotificationService(db).notify_payment_verified(
                tenant_id, invoice.student_id, student_user.full_name, float(payment.amount)
            )

    return payment
