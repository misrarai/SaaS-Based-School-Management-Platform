import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class GoogleCalendarConnection(UUIDPKMixin, TimestampMixin, Base):
    """One tenant's authorization of this app against their own Google account — "the first
    authorized school/admin Google account" per tenant. Only the refresh token is persisted
    (access tokens are short-lived and fetched on demand, never stored); it is never serialized
    into any API response — see app/schemas/google_calendar.py, which exposes connection status
    only (connected/account email/calendar id), not the token itself."""

    __tablename__ = "google_calendar_connections"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_google_calendar_connection_tenant"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    connected_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    google_account_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    refresh_token: Mapped[str] = mapped_column(String(500), nullable=False)
    calendar_id: Mapped[str] = mapped_column(String(255), nullable=False, default="primary")
