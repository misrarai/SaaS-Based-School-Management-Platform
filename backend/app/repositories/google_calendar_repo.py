import uuid

from sqlalchemy import select

from app.models.google_calendar import GoogleCalendarConnection
from app.repositories.base import BaseRepository


class GoogleCalendarConnectionRepository(BaseRepository[GoogleCalendarConnection]):
    model = GoogleCalendarConnection

    def get_by_tenant(self, tenant_id: uuid.UUID) -> GoogleCalendarConnection | None:
        stmt = select(GoogleCalendarConnection).where(GoogleCalendarConnection.tenant_id == tenant_id)
        return self.db.execute(stmt).scalar_one_or_none()
