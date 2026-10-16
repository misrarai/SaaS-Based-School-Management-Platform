import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.resource import Resource
from app.repositories.course_repo import CourseRepository, TeacherAssignmentRepository
from app.repositories.resource_repo import ResourceRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.resource import ResourceCreate


class ResourceService:
    def __init__(self, db: Session):
        self.db = db
        self.resources = ResourceRepository(db)

    def create_resource(
        self,
        tenant_id: uuid.UUID,
        uploaded_by: uuid.UUID,
        payload: ResourceCreate,
        *,
        is_admin: bool = False,
    ) -> Resource:
        """Create a resource.  Teachers may only upload to classes they are actively
        assigned to teach — both class_grade_id and subject_id must be supplied and
        must match an active TeacherAssignment for the uploading teacher.  Admins are
        unrestricted.  The check lives in the service (not the endpoint) so the same
        rule is enforced wherever this method is called.
        """
        if not is_admin:
            # Teachers must specify the target class and subject so we can verify
            # their assignment.  Omitting either field would bypass the check.
            if payload.class_grade_id is None or payload.subject_id is None:
                raise ForbiddenError(
                    "Teachers must specify both class_grade_id and subject_id when uploading resources"
                )
            # TeacherAssignment.teacher_id is a FK to teacher_profiles.id, not users.id.
            # Resolve user_id → teacher_profile_id before querying assignments.
            teacher_profile = TeacherProfileRepository(self.db).get_by_user_id(tenant_id, uploaded_by)
            if teacher_profile is None:
                raise ForbiddenError("Teacher profile not found")
            assignment_repo = TeacherAssignmentRepository(self.db)
            course_repo = CourseRepository(self.db)
            assigned_course_ids = assignment_repo.list_course_ids_for_teacher(tenant_id, teacher_profile.id)
            if assigned_course_ids:
                assigned_courses = course_repo.list_by_ids(tenant_id, assigned_course_ids)
                allowed = any(
                    c.class_grade_id == payload.class_grade_id and c.subject_id == payload.subject_id
                    for c in assigned_courses
                )
            else:
                allowed = False
            if not allowed:
                raise ForbiddenError(
                    "You are not assigned to teach this class and subject"
                )

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
