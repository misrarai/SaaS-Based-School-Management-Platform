import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class PaymentGateway(str, enum.Enum):
    JAZZCASH = "jazzcash"


class GatewayTransactionStatus(str, enum.Enum):
    INITIATED = "initiated"
    COMPLETED = "completed"
    FAILED = "failed"


class GatewayTransaction(UUIDPKMixin, TimestampMixin, Base):
    """One attempt to pay an invoice through a hosted payment gateway (JazzCash today). Created
    the moment the payer clicks "Pay now", before the outcome is known — the gateway's callback
    (or, as a reconciliation fallback, a manual status inquiry) fills in the rest afterwards.

    txn_ref_no is the value handed to the gateway and echoed back unchanged, so it's the only
    reliable key for matching a callback to this row: the callback is a plain HTTP POST from the
    gateway's servers/browser redirect carrying no auth token, tenant id, or session of ours —
    see app/api/v1/endpoints/payment_gateway.py."""

    __tablename__ = "gateway_transactions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("invoices.id"), nullable=False, index=True)
    initiated_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    gateway: Mapped[PaymentGateway] = mapped_column(Enum(PaymentGateway), nullable=False)
    txn_ref_no: Mapped[str] = mapped_column(String(40), nullable=False, unique=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[GatewayTransactionStatus] = mapped_column(
        Enum(GatewayTransactionStatus), default=GatewayTransactionStatus.INITIATED, nullable=False
    )
    gateway_response_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gateway_response_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # e.g. JazzCash's pp_RetreivalReferenceNo — the gateway's own id for the completed transaction.
    gateway_txn_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payment_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("payments.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
