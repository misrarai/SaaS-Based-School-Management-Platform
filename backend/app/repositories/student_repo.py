import uuid

from sqlalchemy import or_, select

from app.models.user import StudentProfile, User
from app.repositories.base import BaseRepository


class StudentProfileRepository(BaseRepository[StudentProfile]):
    model = StudentProfile

    def get_by_user_id(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> StudentProfile | None:
        stmt = select(StudentProfile).where(
            StudentProfile.tenant_id == tenant_id, StudentProfile.user_id == user_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_with_users(
        self,
        tenant_id: uuid.UUID,
        class_grade_id: uuid.UUID | None = None,
        section_id: uuid.UUID | None = None,
        family_id: uuid.UUID | None = None,
        status: str | None = None,
        query: str | None = None,
    ) -> list[tuple[StudentProfile, User]]:
        stmt = (
            select(StudentProfile, User)
            .join(User, User.id == StudentProfile.user_id)
            .where(StudentProfile.tenant_id == tenant_id)
        )
        if class_grade_id is not None:
            stmt = stmt.where(StudentProfile.class_grade_id == class_grade_id)
        if section_id is not None:
            stmt = stmt.where(StudentProfile.section_id == section_id)
        if family_id is not None:
            stmt = stmt.where(StudentProfile.family_id == family_id)
        if status and status != "all":
            if status == "old":
                stmt = stmt.where(StudentProfile.status.in_(["withdrawn", "graduated"]))
            else:
                stmt = stmt.where(StudentProfile.status == status)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    User.full_name.ilike(like),
                    User.email.ilike(like),
                    StudentProfile.roll_number.ilike(like),
                    StudentProfile.admission_number.ilike(like),
                    StudentProfile.guardian_name.ilike(like),
                )
            )
        stmt = stmt.order_by(User.full_name)
        return [(row[0], row[1]) for row in self.db.execute(stmt).all()]

    def get_with_user(self, tenant_id: uuid.UUID, student_profile_id: uuid.UUID) -> tuple[StudentProfile, User] | None:
        stmt = (
            select(StudentProfile, User)
            .join(User, User.id == StudentProfile.user_id)
            .where(StudentProfile.tenant_id == tenant_id, StudentProfile.id == student_profile_id)
        )
        row = self.db.execute(stmt).first()
        return (row[0], row[1]) if row else None

    def max_admission_number(self, tenant_id: uuid.UUID) -> int:
        stmt = select(StudentProfile.admission_number).where(StudentProfile.tenant_id == tenant_id)
        numbers = [row[0] for row in self.db.execute(stmt).all() if row[0] and row[0].isdigit()]
        return max((int(n) for n in numbers), default=0)
