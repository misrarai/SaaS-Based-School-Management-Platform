"""SMS channel abstraction.

There is no SMS provider wired into app settings yet, so configuration is read from plain
environment variables (SMS_API_URL, SMS_API_KEY, optional SMS_SENDER_ID). When they're missing
— and always under ENVIRONMENT=testing, so the suite never performs network I/O — every send
returns a "skipped" result which callers log, mirroring how WhatsApp/email behave when not
configured. The HTTP contract is a generic JSON POST {to, message, sender} with a bearer key,
which matches most Pakistani bulk-SMS gateways' REST APIs; adapt _post for a specific vendor.
"""

import logging
import os
import re
from typing import NamedTuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SmsResult(NamedTuple):
    status: str  # sent | failed | skipped
    detail: str | None = None
    provider_message_id: str | None = None


class SmsService:
    def __init__(self) -> None:
        self.api_url = os.environ.get("SMS_API_URL", "").strip()
        self.api_key = os.environ.get("SMS_API_KEY", "").strip()
        self.sender_id = os.environ.get("SMS_SENDER_ID", "").strip() or None

    def is_configured(self) -> bool:
        if settings.ENVIRONMENT == "testing":
            return False
        return bool(self.api_url and self.api_key)

    @staticmethod
    def normalize_phone(raw: str | None) -> str | None:
        """Normalizes Pakistani mobile numbers (03xx..., +923xx..., 923xx...) to 923xxxxxxxxx;
        any other 10–15 digit number is passed through as digits. Returns None if unusable."""
        if not raw:
            return None
        digits = re.sub(r"\D", "", raw)
        if digits.startswith("0") and len(digits) == 11:
            digits = "92" + digits[1:]
        if 10 <= len(digits) <= 15:
            return digits
        return None

    def send(self, phone_raw: str | None, message: str) -> SmsResult:
        phone = self.normalize_phone(phone_raw)
        if phone is None:
            return SmsResult("failed", "Invalid phone number")
        if not self.is_configured():
            logger.info("SMS not configured — message to %s not sent", phone)
            return SmsResult("skipped", "SMS not configured")
        try:
            return self._post(phone, message)
        except httpx.HTTPError as exc:  # pragma: no cover - network path
            logger.warning("SMS send to %s failed: %s", phone, exc)
            return SmsResult("failed", str(exc)[:500])

    def _post(self, phone: str, message: str) -> SmsResult:  # pragma: no cover - network path
        response = httpx.post(
            self.api_url,
            json={"to": phone, "message": message, "sender": self.sender_id},
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=15,
        )
        if response.status_code >= 400:
            return SmsResult("failed", f"HTTP {response.status_code}: {response.text[:300]}")
        message_id = None
        try:
            payload = response.json()
            message_id = str(payload.get("id") or payload.get("message_id") or "") or None
        except ValueError:
            pass
        return SmsResult("sent", None, message_id)
