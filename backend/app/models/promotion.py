"""Student promotion: admin-defined rules (source class → target class) plus a bulk promote
action that moves selected students up a class (or graduates them). Tenant-scoped."""

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin

ON_FAIL_ACTIONS = ("repeat", "graduate")


class PromotionRule(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "promotion_rules"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    source_class_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=False, index=True)
    # null target = graduating class
    target_class_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("class_grades.id"), nullable=True)
    pass_mark: Mapped[int | None] = mapped_column(Integer, nullable=True)  # advisory
    on_fail: Mapped[str] = mapped_column(String(20), default="repeat", nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
