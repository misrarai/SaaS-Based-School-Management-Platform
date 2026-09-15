import uuid

from sqlalchemy import select

from app.models.academic import AcademicYear, ClassGrade, Section, Subject
from app.repositories.base import BaseRepository


class AcademicYearRepository(BaseRepository[AcademicYear]):
    model = AcademicYear

    def list(self, tenant_id: uuid.UUID) -> list[AcademicYear]:
        stmt = select(AcademicYear).where(AcademicYear.tenant_id == tenant_id).order_by(AcademicYear.start_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def get_by_name(self, tenant_id: uuid.UUID, name: str) -> AcademicYear | None:
        stmt = select(AcademicYear).where(AcademicYear.tenant_id == tenant_id, AcademicYear.name == name)
        return self.db.execute(stmt).scalar_one_or_none()

    def deactivate_all(self, tenant_id: uuid.UUID) -> None:
        for year in self.list(tenant_id):
            year.is_active = False


class ClassGradeRepository(BaseRepository[ClassGrade]):
    model = ClassGrade

    def list(self, tenant_id: uuid.UUID) -> list[ClassGrade]:
        stmt = (
            select(ClassGrade)
            .where(ClassGrade.tenant_id == tenant_id)
            .order_by(ClassGrade.level_order)
        )
        return list(self.db.execute(stmt).scalars().all())


class SectionRepository(BaseRepository[Section]):
    model = Section

    def list_by_class(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID) -> list[Section]:
        stmt = (
            select(Section)
            .where(Section.tenant_id == tenant_id, Section.class_grade_id == class_grade_id)
            .order_by(Section.name)
        )
        return list(self.db.execute(stmt).scalars().all())


class SubjectRepository(BaseRepository[Subject]):
    model = Subject

    def list_by_class(self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID) -> list[Subject]:
        stmt = (
            select(Subject)
            .where(Subject.tenant_id == tenant_id, Subject.class_grade_id == class_grade_id)
            .order_by(Subject.name)
        )
        return list(self.db.execute(stmt).scalars().all())
