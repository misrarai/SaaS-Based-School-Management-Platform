import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.notification import NotificationChannel, NotificationEvent, NotificationLog, NotificationStatus
from app.repositories.notification_repo import NotificationLogRepository
from app.repositories.parent_repo import ParentProfileRepository, ParentStudentLinkRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.user_repo import UserRepository
from app.services.email_service import EmailService
from app.services.whatsapp_service import WhatsAppService


class NotificationService:
    """Fans out domain events (attendance marked, payment verified, fee due) to every channel a
    parent can be reached on — WhatsApp via WhatsAppService and email via EmailService — logging
    every attempt (sent/failed/skipped) regardless of whether credentials are actually configured,
    so the admin always has visibility. send_notification, by contrast, is the admin's ad-hoc
    "compose one message, pick exactly one channel" tool: it never fans out, since the whole point
    there is the admin's explicit channel choice.

    WhatsApp sending is strictly outbound (Admin → this service → Meta Cloud API → recipient) —
    there is no inbound webhook, no conversation state, and no path for a student/parent to
    trigger a send themselves; every method here is only ever called from an admin-authenticated
    request or an internal scheduled job."""

    def __init__(self, db: Session):
        self.db = db
        self.logs = NotificationLogRepository(db)
        self.parent_profiles = ParentProfileRepository(db)
        self.parent_links = ParentStudentLinkRepository(db)
        self.student_profiles = StudentProfileRepository(db)
        self.users = UserRepository(db)
        self.emails = EmailService()
        self.whatsapp = WhatsAppService()

    def _record(
        self,
        tenant_id: uuid.UUID,
        channel: NotificationChannel,
        event: NotificationEvent,
        status: NotificationStatus,
        detail: str | None,
        recipient_user_id: uuid.UUID | None = None,
        recipient_phone: str | None = None,
        recipient_email: str | None = None,
        provider_message_id: str | None = None,
        student_id: uuid.UUID | None = None,
    ) -> NotificationLog:
        log = self.logs.create(
            NotificationLog(
                tenant_id=tenant_id,
                channel=channel,
                event=event,
                recipient_user_id=recipient_user_id,
                recipient_phone=recipient_phone,
                recipient_email=recipient_email,
                provider_message_id=provider_message_id,
                student_id=student_id,
                status=status,
                detail=detail,
                sent_at=datetime.now(timezone.utc),
            )
        )
        self.db.commit()
        self.db.refresh(log)
        return log

    def _parent_recipients_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[tuple[uuid.UUID, str]]:
        recipients: list[tuple[uuid.UUID, str]] = []
        for parent_id in self.parent_links.list_parent_ids_for_student(tenant_id, student_id):
            parent_profile = self.parent_profiles.get_by_id(tenant_id, parent_id)
            if parent_profile is None or not parent_profile.whatsapp_opt_in:
                continue
            user = self.users.get_by_id(tenant_id, parent_profile.user_id)
            if user is not None and user.phone_number:
                recipients.append((user.id, user.phone_number))
        return recipients

    def _parent_emails_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[tuple[uuid.UUID, str]]:
        """Every linked parent's login email — unlike WhatsApp there's no separate opt-in flag,
        since email is the same address the parent already uses to sign in."""
        recipients: list[tuple[uuid.UUID, str]] = []
        for parent_id in self.parent_links.list_parent_ids_for_student(tenant_id, student_id):
            parent_profile = self.parent_profiles.get_by_id(tenant_id, parent_id)
            if parent_profile is None:
                continue
            user = self.users.get_by_id(tenant_id, parent_profile.user_id)
            if user is not None and user.email:
                recipients.append((user.id, user.email))
        return recipients

    def _send_email(
        self, to_email: str, subject: str, body: str, attachments: list[tuple[str, bytes, str]] | None = None
    ) -> tuple[NotificationStatus, str | None]:
        if not self.emails.is_configured():
            return NotificationStatus.SKIPPED, "SMTP not configured"
        success = self.emails.send(to_email, subject, body, attachments=attachments)
        if success:
            return NotificationStatus.SENT, None
        return NotificationStatus.FAILED, "Email delivery failed"

    def _send_whatsapp(
        self, phone_raw: str, student_name: str, title: str, message: str
    ) -> tuple[NotificationStatus, str | None, str | None, str]:
        """Returns (status, detail, provider_message_id, phone_to_log)."""
        normalized = self.whatsapp.validate_phone_number(phone_raw)
        if normalized is None:
            return NotificationStatus.FAILED, "Invalid WhatsApp phone number", None, phone_raw
        if not self.whatsapp.is_configured():
            return NotificationStatus.SKIPPED, "WhatsApp not configured", None, normalized
        result = self.whatsapp.send_template(normalized, body_params=[student_name, title, message])
        status = NotificationStatus.SENT if result.success else NotificationStatus.FAILED
        return status, result.error, result.message_id, normalized

    def _dispatch_whatsapp(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, event: NotificationEvent, student_name: str, title: str, message: str
    ) -> list[NotificationLog]:
        try:
            recipients = self._parent_recipients_for_student(tenant_id, student_id)
            if not recipients:
                return [
                    self._record(
                        tenant_id, NotificationChannel.WHATSAPP, event, NotificationStatus.SKIPPED,
                        "No parent phone on file", student_id=student_id,
                    )
                ]

            logs = []
            for user_id, phone in recipients:
                status, detail, message_id, phone_to_log = self._send_whatsapp(phone, student_name, title, message)
                logs.append(
                    self._record(
                        tenant_id, NotificationChannel.WHATSAPP, event, status, detail,
                        recipient_user_id=user_id, recipient_phone=phone_to_log, provider_message_id=message_id,
                        student_id=student_id,
                    )
                )
            return logs
        except Exception:
            # Notifications are a best-effort side channel layered on top of already-committed
            # domain writes (attendance marked, payment verified) — a bug here must never surface
            # as a failure of the action that triggered it.
            return []

    def _dispatch_email(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, event: NotificationEvent, subject: str, body: str
    ) -> list[NotificationLog]:
        try:
            recipients = self._parent_emails_for_student(tenant_id, student_id)
            if not recipients:
                return [
                    self._record(
                        tenant_id, NotificationChannel.EMAIL, event, NotificationStatus.SKIPPED,
                        "No parent email on file", student_id=student_id,
                    )
                ]

            logs = []
            for user_id, email in recipients:
                log_status, detail = self._send_email(email, subject, body)
                logs.append(
                    self._record(
                        tenant_id, NotificationChannel.EMAIL, event, log_status, detail,
                        recipient_user_id=user_id, recipient_email=email, student_id=student_id,
                    )
                )
            return logs
        except Exception:
            return []

    def notify_attendance_absent(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, student_name: str, session_date: str
    ) -> list[NotificationLog]:
        title = "Attendance Alert"
        message = f"{student_name} was marked ABSENT on {session_date}. Please contact the school if this is unexpected."
        event = NotificationEvent.ATTENDANCE_ABSENT
        return (
            self._dispatch_whatsapp(tenant_id, student_id, event, student_name, title, message)
            + self._dispatch_email(tenant_id, student_id, event, f"Attendance alert: {student_name}", message)
        )

    def notify_payment_verified(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, student_name: str, amount: float
    ) -> list[NotificationLog]:
        title = "Payment Verified"
        message = f"Payment of PKR {amount:,.0f} for {student_name} has been verified. Thank you!"
        event = NotificationEvent.PAYMENT_VERIFIED
        return (
            self._dispatch_whatsapp(tenant_id, student_id, event, student_name, title, message)
            + self._dispatch_email(tenant_id, student_id, event, "Payment verified", message)
        )

    def send_fee_due_reminder(
        self,
        tenant_id: uuid.UUID,
        student_id: uuid.UUID,
        student_name: str,
        invoice_number: str,
        net_amount: float,
        due_date: str,
    ) -> list[NotificationLog]:
        title = f"Fee Reminder: Invoice #{invoice_number}"
        message = (
            f"Reminder: Invoice #{invoice_number} for {student_name} (PKR {net_amount:,.0f}) is due on {due_date}. "
            "Please pay via JazzCash/EasyPaisa/Bank Transfer and upload your receipt."
        )
        event = NotificationEvent.FEE_DUE_REMINDER
        return (
            self._dispatch_whatsapp(tenant_id, student_id, event, student_name, title, message)
            + self._dispatch_email(tenant_id, student_id, event, title, message)
        )

    def list_logs(self, tenant_id: uuid.UUID, student_id: uuid.UUID | None = None, limit: int = 200) -> list[NotificationLog]:
        return self.logs.list_logs(tenant_id, student_id=student_id, limit=limit)

    def broadcast(self, tenant_id: uuid.UUID, student_ids: list[uuid.UUID], message: str) -> tuple[int, int]:
        """Sends one custom-text announcement, over WhatsApp and email, to every parent of every
        given student (e.g. all active students in a set of class grades) — the admin's
        "announcement to a whole class/grade" tool, distinct from the single-student event
        notifiers above. Returns (students_targeted, notifications_sent)."""
        sent_count = 0
        for student_id in student_ids:
            found = self.student_profiles.get_with_user(tenant_id, student_id)
            student_name = found[1].full_name if found is not None else "Student"
            logs = self._dispatch_whatsapp(
                tenant_id, student_id, NotificationEvent.BROADCAST, student_name, "Announcement", message
            ) + self._dispatch_email(tenant_id, student_id, NotificationEvent.BROADCAST, "Announcement", message)
            sent_count += sum(1 for log in logs if log.status == NotificationStatus.SENT)
        return len(student_ids), sent_count

    def send_custom_email(
        self, tenant_id: uuid.UUID, to_email: str, subject: str, message: str
    ) -> NotificationLog:
        """Ad-hoc email to any address the caller supplies — the admin's tool for sending a
        one-off report or piece of information to a recipient not necessarily on file as a
        parent (e.g. a different guardian, an external stakeholder)."""
        status, detail = self._send_email(to_email, subject, message)
        return self._record(
            tenant_id, NotificationChannel.EMAIL, NotificationEvent.CUSTOM_EMAIL, status, detail, recipient_email=to_email,
        )

    def send_notification(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, title: str, message: str, channel: NotificationChannel
    ) -> list[NotificationLog]:
        """The admin's general-purpose "compose and send" tool: exactly one channel — the admin's
        selection is sent as-is, never fanned out to the other channel too. This is deliberately
        different from the automatic domain-event notifiers above, which send on every channel
        available for maximum deliverability of a system-triggered alert.

        Delivered to the selected student's linked parent(s) — like every other notification in
        this app, since a student profile here has no phone/email of its own; the parent's
        contact info on file (User.phone_number / User.email) is the only real destination."""
        found = self.student_profiles.get_with_user(tenant_id, student_id)
        if found is None:
            raise NotFoundError("Student not found")
        _profile, student_user = found

        if channel == NotificationChannel.EMAIL:
            recipients = self._parent_emails_for_student(tenant_id, student_id)
            if not recipients:
                return [
                    self._record(
                        tenant_id, NotificationChannel.EMAIL, NotificationEvent.ADMIN_NOTIFICATION, NotificationStatus.FAILED,
                        "No parent email on file for this student", student_id=student_id,
                    )
                ]
            logs = []
            for user_id, email in recipients:
                status, detail = self._send_email(email, title, message)
                logs.append(
                    self._record(
                        tenant_id, NotificationChannel.EMAIL, NotificationEvent.ADMIN_NOTIFICATION, status, detail,
                        recipient_user_id=user_id, recipient_email=email, student_id=student_id,
                    )
                )
            return logs

        # channel == NotificationChannel.WHATSAPP
        recipients = self._parent_recipients_for_student(tenant_id, student_id)
        if not recipients:
            return [
                self._record(
                    tenant_id, NotificationChannel.WHATSAPP, NotificationEvent.ADMIN_NOTIFICATION, NotificationStatus.FAILED,
                    "No parent WhatsApp number on file for this student (or the parent has opted out)",
                    student_id=student_id,
                )
            ]
        logs = []
        for user_id, phone in recipients:
            status, detail, message_id, phone_to_log = self._send_whatsapp(phone, student_user.full_name, title, message)
            logs.append(
                self._record(
                    tenant_id, NotificationChannel.WHATSAPP, NotificationEvent.ADMIN_NOTIFICATION, status, detail,
                    recipient_user_id=user_id, recipient_phone=phone_to_log, provider_message_id=message_id,
                    student_id=student_id,
                )
            )
        return logs

    def send_report_card_email(
        self,
        tenant_id: uuid.UUID,
        student_id: uuid.UUID,
        student_name: str,
        period_label: str,
        pdf_bytes: bytes,
        to_email: str | None = None,
    ) -> list[NotificationLog]:
        """Emails the student's report card PDF. Defaults to every linked parent's email; pass
        to_email to send to one specific (dynamic) address instead — e.g. an admin re-sending it
        to a guardian who isn't in the system as a parent user."""
        subject = f"Report card — {student_name} ({period_label})"
        body = f"Please find attached the report card for {student_name} for {period_label}."
        attachments = [("report-card.pdf", pdf_bytes, "pdf")]

        if to_email is not None:
            status, detail = self._send_email(to_email, subject, body, attachments=attachments)
            return [
                self._record(
                    tenant_id, NotificationChannel.EMAIL, NotificationEvent.REPORT_CARD, status, detail,
                    recipient_email=to_email, student_id=student_id,
                )
            ]

        recipients = self._parent_emails_for_student(tenant_id, student_id)
        if not recipients:
            return [
                self._record(
                    tenant_id, NotificationChannel.EMAIL, NotificationEvent.REPORT_CARD, NotificationStatus.SKIPPED,
                    "No parent email on file", student_id=student_id,
                )
            ]

        logs = []
        for user_id, email in recipients:
            status, detail = self._send_email(email, subject, body, attachments=attachments)
            logs.append(
                self._record(
                    tenant_id, NotificationChannel.EMAIL, NotificationEvent.REPORT_CARD, status, detail,
                    recipient_user_id=user_id, recipient_email=email, student_id=student_id,
                )
            )
        return logs
