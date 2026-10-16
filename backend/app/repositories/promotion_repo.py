import uuid

from sqlalchemy import select

from app.models.promotion import PromotionRule
from app.repositories.base import BaseRepository


class PromotionRuleRepository(BaseRepository[PromotionRule]):
    model = PromotionRule

    def list_all(self, tenant_id: uuid.UUID) -> list[PromotionRule]:
        stmt = select(PromotionRule).where(PromotionRule.tenant_id == tenant_id).order_by(PromotionRule.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())
