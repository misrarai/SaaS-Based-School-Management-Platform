import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SUCCESS_RESPONSE_CODE = "000"


class JazzCashCallbackResult(NamedTuple):
    hash_valid: bool
    success: bool
    txn_ref_no: str | None
    response_code: str | None
    response_message: str | None
    retrieval_reference_no: str | None


class JazzCashService:
    """JazzCash's Page-based / HTTP-POST hosted-checkout integration: the payer is redirected
    (via an auto-submitting HTML form) to JazzCash's own payment page with a signed set of pp_*
    fields, pays there, and JazzCash redirects/POSTs back to our callback URL with the outcome
    plus its own pp_SecureHash — which we must recompute and compare before trusting anything in
    that callback, since it arrives over the open internet with no other authentication.

    Field names, the HMAC-SHA256-over-sorted-values hash algorithm, and the amount-in-paisas
    convention follow JazzCash's published HTTP-POST integration guide. The exact sandbox/live
    endpoint paths and merchant credentials are configured via JAZZCASH_* settings — confirm them
    against your own merchant onboarding documentation before going live; this service reads
    them from config rather than hard-coding anything so that's a one-line .env change."""

    def is_configured(self) -> bool:
        if settings.ENVIRONMENT == "testing":
            return False
        return bool(
            settings.JAZZCASH_MERCHANT_ID and settings.JAZZCASH_PASSWORD and settings.JAZZCASH_INTEGRITY_SALT
        )

    @staticmethod
    def to_paisas(amount_pkr: float) -> str:
        """JazzCash amounts are integers in the currency's smallest unit (paisas = PKR * 100),
        with no decimal point."""
        return str(int(round(amount_pkr * 100)))

    def _generate_secure_hash(self, fields: dict[str, str]) -> str:
        """HMAC-SHA256, keyed with the Integrity Salt, over every non-empty pp_* value (never
        the field names) sorted alphabetically by field name, joined with '&' and prefixed by
        the salt itself as the first segment."""
        sorted_values = [
            value
            for key, value in sorted(fields.items())
            if key != "pp_SecureHash" and value not in (None, "")
        ]
        hash_string = settings.JAZZCASH_INTEGRITY_SALT + "&" + "&".join(sorted_values)
        digest = hmac.new(
            settings.JAZZCASH_INTEGRITY_SALT.encode("utf-8"), hash_string.encode("utf-8"), hashlib.sha256
        ).hexdigest()
        return digest.upper()

    def build_checkout_fields(
        self, txn_ref_no: str, amount_pkr: float, bill_reference: str, description: str
    ) -> dict[str, str]:
        """Returns the complete pp_* field set (secure hash included) to render as hidden inputs
        on an HTML form that auto-submits via POST to settings.JAZZCASH_CHECKOUT_URL."""
        now = datetime.now(timezone.utc)
        expiry = now + timedelta(minutes=settings.JAZZCASH_TXN_EXPIRY_MINUTES)

        fields = {
            "pp_Version": settings.JAZZCASH_VERSION,
            "pp_TxnType": settings.JAZZCASH_TXN_TYPE,
            "pp_Language": "EN",
            "pp_MerchantID": settings.JAZZCASH_MERCHANT_ID or "",
            "pp_Password": settings.JAZZCASH_PASSWORD or "",
            "pp_BankID": settings.JAZZCASH_BANK_ID,
            "pp_ProductID": settings.JAZZCASH_PRODUCT_ID,
            "pp_TxnRefNo": txn_ref_no,
            "pp_Amount": self.to_paisas(amount_pkr),
            "pp_TxnCurrency": "PKR",
            "pp_TxnDateTime": now.strftime("%Y%m%d%H%M%S"),
            "pp_TxnExpiryDateTime": expiry.strftime("%Y%m%d%H%M%S"),
            "pp_BillReference": bill_reference,
            "pp_Description": description,
            "pp_ReturnURL": settings.JAZZCASH_RETURN_URL or "",
        }
        fields["pp_SecureHash"] = self._generate_secure_hash(fields)
        return fields

    def parse_callback(self, fields: dict[str, str]) -> JazzCashCallbackResult:
        """Validates the callback's secure hash and extracts the outcome. Never trust
        pp_ResponseCode from a callback whose hash_valid is False."""
        received_hash = fields.get("pp_SecureHash", "")
        expected_hash = self._generate_secure_hash(fields)
        hash_valid = hmac.compare_digest(received_hash.upper(), expected_hash)

        response_code = fields.get("pp_ResponseCode")
        return JazzCashCallbackResult(
            hash_valid=hash_valid,
            success=hash_valid and response_code == SUCCESS_RESPONSE_CODE,
            txn_ref_no=fields.get("pp_TxnRefNo"),
            response_code=response_code,
            response_message=fields.get("pp_ResponseMessage"),
            retrieval_reference_no=fields.get("pp_RetreivalReferenceNo"),
        )

    def inquire_transaction(self, txn_ref_no: str) -> dict | None:
        """Reconciliation fallback: asks JazzCash directly for a transaction's status, for when
        a callback never arrives (browser closed, network drop) or looks tampered with. Returns
        None on any failure — this is a best-effort double-check, not the primary path, and a
        confirmed payment must never be reverted just because this call failed."""
        if not self.is_configured():
            return None
        payload = {
            "pp_MerchantID": settings.JAZZCASH_MERCHANT_ID,
            "pp_Password": settings.JAZZCASH_PASSWORD,
            "pp_TxnRefNo": txn_ref_no,
        }
        try:
            response = httpx.post(settings.JAZZCASH_INQUIRY_URL, json=payload, timeout=15.0)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            logger.warning("JazzCash status inquiry failed for %s: %s", txn_ref_no, exc)
            return None
