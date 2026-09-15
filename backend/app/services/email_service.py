import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Best-effort delivery, same posture as NotificationService for WhatsApp: an academy that
    hasn't configured SMTP yet still gets working verification/reset *tokens*, they just land in
    the server log instead of an inbox until real credentials are added. A delivery failure here
    must never surface as a failure of the action that triggered it (registration, password reset
    request), since forgot-password in particular must always look the same to the caller whether
    or not the account/email exists."""

    def is_configured(self) -> bool:
        # Same convention as app.core.rate_limit / app.core.scheduler: the test suite must never
        # perform real network I/O, even though .env's real SMTP credentials are still visible to
        # it (pydantic-settings loads .env regardless of ENVIRONMENT). Tests that need to inspect
        # what would have been sent monkeypatch EmailService.send directly instead.
        if settings.ENVIRONMENT == "testing":
            return False
        return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)

    def send(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        attachments: list[tuple[str, bytes, str]] | None = None,
    ) -> bool:
        """attachments is a list of (filename, content, mime_subtype) e.g. ("report-card.pdf", pdf_bytes, "pdf")."""
        if not self.is_configured():
            # WARNING, not INFO — a plain module logger has no handler until the app configures
            # one, and the handler-of-last-resort only prints WARNING and above, so this is what
            # actually makes the token/link visible in the server log by default.
            logger.warning("SMTP not configured — email to %s not sent.\nSubject: %s\n%s", to_email, subject, body_text)
            return False

        message = EmailMessage()
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body_text)
        for filename, content, subtype in attachments or []:
            message.add_attachment(content, maintype="application", subtype=subtype, filename=filename)

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
                if settings.SMTP_USE_TLS:
                    smtp.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(message)
            return True
        except (smtplib.SMTPException, OSError) as exc:
            logger.warning("Failed to send email to %s: %s", to_email, exc)
            return False
