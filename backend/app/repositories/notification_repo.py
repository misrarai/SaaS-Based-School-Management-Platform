import uuid

from sqlalchemy import select

from app.models.notification import NotificationLog
from app.repositories.base import BaseRepository


class NotificationLogRepository(BaseRepository[NotificationLog]):
    model = NotificationLog

    def list_logs(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID | None = None, limit: int = 200
    ) -> list[NotificationLog]:
        stmt = select(NotificationLog).where(NotificationLog.tenant_id == tenant_id)
        if student_id is not None:
            stmt = stmt.where(NotificationLog.student_id == student_id)
        stmt = stmt.order_by(NotificationLog.sent_at.desc()).limit(limit)
        return list(self.db.execute(stmt).scalars().all())
