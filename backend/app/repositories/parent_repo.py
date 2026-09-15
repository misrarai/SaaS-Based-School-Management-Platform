import uuid

from sqlalchemy import select

from app.models.user import ParentProfile, ParentStudentLink
from app.repositories.base import BaseRepository


class ParentProfileRepository(BaseRepository[ParentProfile]):
    model = ParentProfile

    def get_by_user_id(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> ParentProfile | None:
        stmt = select(ParentProfile).where(ParentProfile.tenant_id == tenant_id, ParentProfile.user_id == user_id)
        return self.db.execute(stmt).scalar_one_or_none()


class ParentStudentLinkRepository(BaseRepository[ParentStudentLink]):
    model = ParentStudentLink

    def list_student_ids(self, tenant_id: uuid.UUID, parent_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(ParentStudentLink.student_id).where(
            ParentStudentLink.tenant_id == tenant_id, ParentStudentLink.parent_id == parent_id
        )
        return [row[0] for row in self.db.execute(stmt).all()]

    def is_linked(self, tenant_id: uuid.UUID, parent_id: uuid.UUID, student_id: uuid.UUID) -> bool:
        stmt = select(ParentStudentLink.id).where(
            ParentStudentLink.tenant_id == tenant_id,
            ParentStudentLink.parent_id == parent_id,
            ParentStudentLink.student_id == student_id,
        )
        return self.db.execute(stmt).first() is not None

    def list_parent_ids_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(ParentStudentLink.parent_id).where(
            ParentStudentLink.tenant_id == tenant_id, ParentStudentLink.student_id == student_id
        )
        return [row[0] for row in self.db.execute(stmt).all()]
