import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import GUID, TimestampMixin, UUIDPKMixin


class ResourceType(str, enum.Enum):
    LINK = "link"
    DOCUMENT = "document"
    VIDEO = "video"
    NOTES = "notes"
    WORKSHEET = "worksheet"


class Resource(UUIDPKMixin, TimestampMixin, Base):
    """A curated external link (Khan Academy, past papers, etc.) or an uploaded worksheet/
    slide deck, organized by class + subject + a freeform category tag (e.g. 'Past Papers/2023')."""

    __tablename__ = "resources"

    tenant_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_type: Mapped[ResourceType] = mapped_column(Enum(ResourceType), nullable=False)
    external_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    class_grade_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("class_grades.id"), nullable=True, index=True
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("subjects.id"), nullable=True, index=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("chapters.id"), nullable=True, index=True)
