import uuid

from sqlalchemy import select

from app.models.automation import AutomationRule, AutomationRun
from app.repositories.base import BaseRepository


class AutomationRuleRepository(BaseRepository[AutomationRule]):
    model = AutomationRule

    def list_all(self, tenant_id: uuid.UUID, event: str | None = None) -> list[AutomationRule]:
        stmt = select(AutomationRule).where(AutomationRule.tenant_id == tenant_id)
        if event:
            stmt = stmt.where(AutomationRule.event == event)
        return list(self.db.execute(stmt.order_by(AutomationRule.created_at.desc())).scalars().all())

    def list_active_for_event(self, tenant_id: uuid.UUID, event: str) -> list[AutomationRule]:
        stmt = select(AutomationRule).where(
            AutomationRule.tenant_id == tenant_id,
            AutomationRule.event == event,
            AutomationRule.is_active.is_(True),
        )
        return list(self.db.execute(stmt).scalars().all())


class AutomationRunRepository(BaseRepository[AutomationRun]):
    model = AutomationRun

    def list_recent(self, tenant_id: uuid.UUID, limit: int = 100) -> list[AutomationRun]:
        stmt = (
            select(AutomationRun)
            .where(AutomationRun.tenant_id == tenant_id)
            .order_by(AutomationRun.fired_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())
