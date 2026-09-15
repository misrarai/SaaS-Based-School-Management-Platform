import uuid

from sqlalchemy import select

from app.models.resource import Resource
from app.repositories.base import BaseRepository


class ResourceRepository(BaseRepository[Resource]):
    model = Resource

    def list_filtered(
        self,
        tenant_id: uuid.UUID,
        class_grade_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        category: str | None = None,
        chapter_id: uuid.UUID | None = None,
        resource_type: str | None = None,
    ) -> list[Resource]:
        stmt = select(Resource).where(Resource.tenant_id == tenant_id)
        if class_grade_id is not None:
            stmt = stmt.where(Resource.class_grade_id == class_grade_id)
        if subject_id is not None:
            stmt = stmt.where(Resource.subject_id == subject_id)
        if category is not None:
            stmt = stmt.where(Resource.category == category)
        if chapter_id is not None:
            stmt = stmt.where(Resource.chapter_id == chapter_id)
        if resource_type is not None:
            stmt = stmt.where(Resource.resource_type == resource_type)
        stmt = stmt.order_by(Resource.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def list_by_chapter(self, tenant_id: uuid.UUID, chapter_id: uuid.UUID) -> list[Resource]:
        stmt = (
            select(Resource)
            .where(Resource.tenant_id == tenant_id, Resource.chapter_id == chapter_id)
            .order_by(Resource.created_at)
        )
        return list(self.db.execute(stmt).scalars().all())
