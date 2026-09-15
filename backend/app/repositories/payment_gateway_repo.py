import uuid

from sqlalchemy import select

from app.models.payment_gateway import GatewayTransaction
from app.repositories.base import BaseRepository


class GatewayTransactionRepository(BaseRepository[GatewayTransaction]):
    model = GatewayTransaction

    def get_by_txn_ref_no(self, txn_ref_no: str) -> GatewayTransaction | None:
        """Tenant-agnostic lookup: the gateway's callback carries no tenant context of ours, only
        the txn_ref_no we handed it — same pattern as UserRepository.get_by_id_any_tenant for
        JWT decoding."""
        stmt = select(GatewayTransaction).where(GatewayTransaction.txn_ref_no == txn_ref_no)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_invoice(self, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> list[GatewayTransaction]:
        stmt = (
            select(GatewayTransaction)
            .where(GatewayTransaction.tenant_id == tenant_id, GatewayTransaction.invoice_id == invoice_id)
            .order_by(GatewayTransaction.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())
