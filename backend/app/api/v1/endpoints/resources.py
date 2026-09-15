import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.resource import ResourceType
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.resource import ResourceCreate, ResourceOut
from app.services.parent_service import ParentService
from app.services.resource_service import ResourceService

router = APIRouter(prefix="/resources", tags=["resources"])


@router.post("", response_model=ResourceOut, status_code=status.HTTP_201_CREATED)
def create_resource(
    payload: ResourceCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> ResourceOut:
    return ResourceService(db).create_resource(current_user.tenant_id, current_user.id, payload)


@router.get("", response_model=list[ResourceOut])
def list_resources(
    class_grade_id: uuid.UUID | None = Query(default=None),
    subject_id: uuid.UUID | None = Query(default=None),
    category: str | None = Query(default=None),
    chapter_id: uuid.UUID | None = Query(default=None),
    resource_type: ResourceType | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[ResourceOut]:
    tenant_id = current_user.tenant_id
    service = ResourceService(db)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return service.list_resources(
            tenant_id,
            class_grade_id=profile.class_grade_id,
            subject_id=subject_id,
            category=category,
            chapter_id=chapter_id,
            resource_type=resource_type,
        )

    if current_user.role == RoleEnum.PARENT:
        children = ParentService(db).list_children_profiles(tenant_id, current_user.id)
        class_grade_ids = {c.class_grade_id for c in children if c.class_grade_id is not None}
        results = []
        for cgid in class_grade_ids:
            results.extend(
                service.list_resources(
                    tenant_id, class_grade_id=cgid, subject_id=subject_id, category=category, chapter_id=chapter_id, resource_type=resource_type
                )
            )
        return results

    return service.list_resources(
        tenant_id, class_grade_id=class_grade_id, subject_id=subject_id, category=category, chapter_id=chapter_id, resource_type=resource_type
    )


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(
    resource_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> None:
    ResourceService(db).delete_resource(
        current_user.tenant_id, resource_id, current_user.id, current_user.role == RoleEnum.ADMIN
    )
