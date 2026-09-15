import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.fee import InvoiceStatus
from app.models.notification import NotificationStatus
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.notification import (
    BroadcastRequest,
    BroadcastResult,
    NotificationLogOut,
    SendCustomEmailRequest,
    SendDueRemindersRequest,
    SendDueRemindersResult,
    SendNotificationRequest,
)
from app.services.fee_service import FeeService
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/logs", response_model=list[NotificationLogOut])
def list_logs(
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[NotificationLogOut]:
    return NotificationService(db).list_logs(current_user.tenant_id, student_id=student_id)


@router.post("/broadcast", response_model=BroadcastResult)
def broadcast(
    payload: BroadcastRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> BroadcastResult:
    tenant_id = current_user.tenant_id
    student_repo = StudentProfileRepository(db)

    if payload.class_grade_ids:
        student_ids: list[uuid.UUID] = []
        for class_grade_id in payload.class_grade_ids:
            student_ids.extend(
                profile.id
                for profile, _user in student_repo.list_with_users(
                    tenant_id, class_grade_id=class_grade_id, status="active"
                )
            )
    else:
        student_ids = [profile.id for profile, _user in student_repo.list_with_users(tenant_id, status="active")]

    targeted, sent = NotificationService(db).broadcast(tenant_id, student_ids, payload.message)
    return BroadcastResult(students_targeted=targeted, notifications_sent=sent)


@router.post("/send", response_model=list[NotificationLogOut], status_code=status.HTTP_201_CREATED)
def send_notification(
    payload: SendNotificationRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[NotificationLogOut]:
    """Admin composes one notification (title + message) for one student and picks exactly one
    delivery channel — email or WhatsApp, never both. Only ADMIN can reach this; a student or
    parent token is rejected by require_role before any WhatsApp/email code runs."""
    return NotificationService(db).send_notification(
        current_user.tenant_id, payload.student_id, payload.title, payload.message, payload.channel
    )


@router.post("/send-email", response_model=NotificationLogOut, status_code=status.HTTP_201_CREATED)
def send_email(
    payload: SendCustomEmailRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> NotificationLogOut:
    return NotificationService(db).send_custom_email(
        current_user.tenant_id, payload.to_email, payload.subject, payload.message
    )


@router.post("/fee-due-reminders", response_model=SendDueRemindersResult)
def send_fee_due_reminders(
    payload: SendDueRemindersRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> SendDueRemindersResult:
    tenant_id = current_user.tenant_id
    fee_service = FeeService(db)
    notification_service = NotificationService(db)
    student_repo = StudentProfileRepository(db)

    cutoff = date.today() + timedelta(days=payload.days_ahead)
    invoices = [
        inv for inv in fee_service.list_invoices(tenant_id, status=InvoiceStatus.PENDING) if inv.due_date <= cutoff
    ]

    sent_count = 0
    for invoice in invoices:
        found = student_repo.get_with_user(tenant_id, invoice.student_id)
        if found is None:
            continue
        _, user = found
        logs = notification_service.send_fee_due_reminder(
            tenant_id,
            invoice.student_id,
            user.full_name,
            invoice.invoice_number,
            float(invoice.net_amount),
            invoice.due_date.isoformat(),
        )
        sent_count += sum(1 for log in logs if log.status == NotificationStatus.SENT)

    return SendDueRemindersResult(invoices_checked=len(invoices), notifications_sent=sent_count)
