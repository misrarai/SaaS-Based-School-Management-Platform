import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class Family(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "families"
    __table_args__ = (UniqueConstraint("tenant_id", "family_number", name="uq_family_tenant_number"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    family_number: Mapped[str] = mapped_column(String(20), nullable=False)
    family_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cnic: Mapped[str | None] = mapped_column(String(30), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
