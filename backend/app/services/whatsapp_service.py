import logging
import re
from typing import NamedTuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Local Pakistani numbers are stored as "03XXXXXXXXX" throughout this app (see User.phone_number).
# Meta requires E.164 (leading "+", country code, no spaces/dashes) — this pattern accepts either
# an already-E.164 number or a bare local one and normalizes both.
_E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")
_LOCAL_PK_RE = re.compile(r"^0\d{10}$")


class WhatsAppSendResult(NamedTuple):
    success: bool
    message_id: str | None
    error: str | None


class WhatsAppService:
    """Outbound-only wrapper around Meta's WhatsApp Business Platform Cloud API. This is
    deliberately one-directional: the app never reads or reacts to inbound WhatsApp messages, so
    there is no webhook handler, no conversation state, and no student-initiated path here at
    all — every call originates from an admin action inside NotificationService.

    Business-initiated messages (i.e. not a reply within a 24h customer-service window opened by
    the recipient) must use a pre-approved template — see send_template. Free-form text sending
    is intentionally not exposed here for that reason."""

    def is_configured(self) -> bool:
        # Same convention as EmailService: the test suite must never perform real network I/O,
        # even though .env's real credentials (once set) would otherwise satisfy this check.
        if settings.ENVIRONMENT == "testing":
            return False
        return bool(settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)

    def validate_phone_number(self, raw: str | None) -> str | None:
        """Normalizes to E.164 for Meta, or returns None if no usable number exists."""
        if not raw:
            return None
        candidate = raw.strip().replace(" ", "").replace("-", "")
        if _E164_RE.match(candidate):
            return candidate
        if _LOCAL_PK_RE.match(candidate):
            return "+92" + candidate[1:]
        return None

    def _messages_url(self) -> str:
        return f"{settings.WHATSAPP_API_BASE_URL}/{settings.WHATSAPP_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"

    def _parse_error(self, response: httpx.Response) -> str:
        try:
            error = response.json().get("error", {})
            return error.get("message") or f"WhatsApp API returned HTTP {response.status_code}"
        except ValueError:
            return f"WhatsApp API returned HTTP {response.status_code}"

    def send_template(
        self,
        to_phone: str,
        template_name: str | None = None,
        language_code: str | None = None,
        body_params: list[str] | None = None,
    ) -> WhatsAppSendResult:
        """Sends a pre-approved Meta template message. body_params are substituted in order into
        the template's {{1}}, {{2}}, {{3}}... body placeholders (e.g. the school_notification
        template's {{student_name}}, {{notification_title}}, {{message}})."""
        if not self.is_configured():
            logger.warning("WhatsApp not configured — message to %s not sent.", to_phone)
            return WhatsAppSendResult(False, None, "WhatsApp is not configured")

        template_name = template_name or settings.WHATSAPP_TEMPLATE_NAME
        language_code = language_code or settings.WHATSAPP_TEMPLATE_LANGUAGE
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": (
                    [{"type": "body", "parameters": [{"type": "text", "text": p} for p in body_params]}]
                    if body_params
                    else []
                ),
            },
        }

        try:
            response = httpx.post(
                self._messages_url(),
                headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
                json=payload,
                timeout=10.0,
            )
            response.raise_for_status()
            message_id = response.json().get("messages", [{}])[0].get("id")
            logger.info("WhatsApp template '%s' sent to %s (message_id=%s)", template_name, to_phone, message_id)
            return WhatsAppSendResult(True, message_id, None)
        except httpx.HTTPStatusError as exc:
            error = self._parse_error(exc.response)
            logger.warning("WhatsApp API rejected message to %s: %s", to_phone, error)
            return WhatsAppSendResult(False, None, error)
        except httpx.TimeoutException:
            logger.warning("WhatsApp API request to %s timed out", to_phone)
            return WhatsAppSendResult(False, None, "WhatsApp API request timed out")
        except httpx.HTTPError as exc:
            logger.warning("WhatsApp API request to %s failed: %s", to_phone, exc)
            return WhatsAppSendResult(False, None, "WhatsApp API request failed")
