"""In-process background scheduler for recurring, tenant-wide fee operations — no Redis/Celery
needed for a single-server academy deployment. Every job loops over all active tenants and
isolates failures per-tenant so one broken tenant never blocks the rest.

Disabled entirely when ENVIRONMENT=="testing" (same convention as app.core.rate_limit) so the
test suite never spawns background threads against the dev database.
"""

import logging
from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.fee import InvoiceStatus
from app.models.tenant import Tenant
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.fee import BulkGenerateInvoicesRequest
from app.services.fee_service import FeeService
from app.services.notification_service import NotificationService

logger = logging.getLogger("app.scheduler")

scheduler = BackgroundScheduler(timezone="UTC")


def _active_tenant_ids(db) -> list:
    return [row[0] for row in db.execute(select(Tenant.id).where(Tenant.is_active.is_(True))).all()]


def generate_monthly_invoices_job() -> None:
    """1st of every month: generate this month's tuition invoices for every class that has a
    fee plan, in every tenant. Due date defaults to the 10th."""
    db = SessionLocal()
    try:
        today = date.today()
        due_date = date(today.year, today.month, 10)
        for tenant_id in _active_tenant_ids(db):
            try:
                result = FeeService(db).bulk_generate_monthly_invoices(
                    tenant_id,
                    BulkGenerateInvoicesRequest(period_month=today.month, period_year=today.year, due_date=due_date),
                )
                logger.info("tenant=%s monthly invoices created=%s", tenant_id, result.invoices_created)
            except Exception:
                logger.exception("Monthly invoice generation failed for tenant %s", tenant_id)
    finally:
        db.close()


def send_fee_due_reminders_job() -> None:
    """5th of every month: WhatsApp reminder for every PENDING invoice due within 3 days."""
    db = SessionLocal()
    try:
        cutoff = date.today() + timedelta(days=3)
        for tenant_id in _active_tenant_ids(db):
            try:
                fee_service = FeeService(db)
                notification_service = NotificationService(db)
                student_repo = StudentProfileRepository(db)
                invoices = [
                    inv
                    for inv in fee_service.list_invoices(tenant_id, status=InvoiceStatus.PENDING)
                    if inv.due_date <= cutoff
                ]
                for invoice in invoices:
                    found = student_repo.get_with_user(tenant_id, invoice.student_id)
                    if found is None:
                        continue
                    _, user = found
                    notification_service.send_fee_due_reminder(
                        tenant_id,
                        invoice.student_id,
                        user.full_name,
                        invoice.invoice_number,
                        float(invoice.net_amount),
                        invoice.due_date.isoformat(),
                    )
                logger.info("tenant=%s fee reminders checked=%s", tenant_id, len(invoices))
            except Exception:
                logger.exception("Fee due reminders failed for tenant %s", tenant_id)
    finally:
        db.close()


def mark_overdue_invoices_job() -> None:
    """Daily: flip PENDING invoices past their due date to OVERDUE."""
    db = SessionLocal()
    try:
        for tenant_id in _active_tenant_ids(db):
            try:
                count = FeeService(db).mark_overdue_invoices(tenant_id)
                if count:
                    logger.info("tenant=%s marked overdue=%s", tenant_id, count)
            except Exception:
                logger.exception("Mark-overdue-invoices failed for tenant %s", tenant_id)
    finally:
        db.close()


def start_scheduler() -> None:
    if settings.ENVIRONMENT == "testing" or scheduler.running:
        return
    scheduler.add_job(
        generate_monthly_invoices_job, "cron", day=1, hour=0, minute=30,
        id="generate_monthly_invoices", replace_existing=True,
    )
    scheduler.add_job(
        send_fee_due_reminders_job, "cron", day=5, hour=9, minute=0,
        id="send_fee_due_reminders", replace_existing=True,
    )
    scheduler.add_job(
        mark_overdue_invoices_job, "cron", hour=1, minute=0,
        id="mark_overdue_invoices", replace_existing=True,
    )
    scheduler.start()
    logger.info("Background scheduler started (monthly invoices, fee reminders, overdue marking)")


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
