import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.resource import Resource
from app.repositories.resource_repo import ResourceRepository
from app.schemas.resource import ResourceCreate


class ResourceService:
    def __init__(self, db: Session):
        self.db = db
        self.resources = ResourceRepository(db)

    def create_resource(self, tenant_id: uuid.UUID, uploaded_by: uuid.UUID, payload: ResourceCreate) -> Resource:
        resource = self.resources.create(
            Resource(
                tenant_id=tenant_id,
                title=payload.title,
                description=payload.description,
                resource_type=payload.resource_type,
                external_url=payload.external_url,
                file_url=payload.file_url,
                class_grade_id=payload.class_grade_id,
                subject_id=payload.subject_id,
                category=payload.category,
                uploaded_by_user_id=uploaded_by,
                chapter_id=payload.chapter_id,
            )
        )
        self.db.commit()
        self.db.refresh(resource)
        return resource

    def list_resources(
        self,
        tenant_id: uuid.UUID,
        class_grade_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        category: str | None = None,
        chapter_id: uuid.UUID | None = None,
        resource_type: str | None = None,
    ) -> list[Resource]:
        return self.resources.list_filtered(tenant_id, class_grade_id, subject_id, category, chapter_id, resource_type)

    def delete_resource(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, current_user_id: uuid.UUID, is_admin: bool) -> None:
        resource = self.resources.get_by_id(tenant_id, resource_id)
        if resource is None:
            raise NotFoundError("Resource not found")
        if not is_admin and resource.uploaded_by_user_id != current_user_id:
            raise ForbiddenError("You can only delete your own uploads")
        self.resources.delete(tenant_id, resource_id)
        self.db.commit()
