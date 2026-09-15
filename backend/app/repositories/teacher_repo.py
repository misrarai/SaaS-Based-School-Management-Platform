import uuid

from sqlalchemy import or_, select

from app.models.user import TeacherProfile, User
from app.repositories.base import BaseRepository


class TeacherProfileRepository(BaseRepository[TeacherProfile]):
    model = TeacherProfile

    def get_by_user_id(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> TeacherProfile | None:
        stmt = select(TeacherProfile).where(
            TeacherProfile.tenant_id == tenant_id, TeacherProfile.user_id == user_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_with_users(self, tenant_id: uuid.UUID, query: str | None = None) -> list[tuple[TeacherProfile, User]]:
        stmt = (
            select(TeacherProfile, User)
            .join(User, User.id == TeacherProfile.user_id)
            .where(TeacherProfile.tenant_id == tenant_id)
        )
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    User.full_name.ilike(like),
                    User.email.ilike(like),
                    TeacherProfile.employee_code.ilike(like),
                    TeacherProfile.qualification.ilike(like),
                )
            )
        stmt = stmt.order_by(User.full_name)
        return [(row[0], row[1]) for row in self.db.execute(stmt).all()]

    def get_with_user(self, tenant_id: uuid.UUID, teacher_profile_id: uuid.UUID) -> tuple[TeacherProfile, User] | None:
        stmt = (
            select(TeacherProfile, User)
            .join(User, User.id == TeacherProfile.user_id)
            .where(TeacherProfile.tenant_id == tenant_id, TeacherProfile.id == teacher_profile_id)
        )
        row = self.db.execute(stmt).first()
        return (row[0], row[1]) if row else None
