import uuid

from sqlalchemy import delete, select

from app.models.exam import (
    Exam,
    ExamClass,
    ExamMark,
    ExamSchedule,
    ExamStudentRemark,
    GradingBand,
    GradingScheme,
)
from app.repositories.base import BaseRepository


class GradingSchemeRepository(BaseRepository[GradingScheme]):
    model = GradingScheme

    def list(self, tenant_id: uuid.UUID) -> list[GradingScheme]:
        stmt = select(GradingScheme).where(GradingScheme.tenant_id == tenant_id).order_by(GradingScheme.name)
        return list(self.db.execute(stmt).scalars().all())

    def get_default(self, tenant_id: uuid.UUID) -> GradingScheme | None:
        stmt = select(GradingScheme).where(GradingScheme.tenant_id == tenant_id, GradingScheme.is_default.is_(True))
        return self.db.execute(stmt).scalars().first()

    def get_by_name(self, tenant_id: uuid.UUID, name: str) -> GradingScheme | None:
        stmt = select(GradingScheme).where(GradingScheme.tenant_id == tenant_id, GradingScheme.name == name)
        return self.db.execute(stmt).scalar_one_or_none()

    def clear_default(self, tenant_id: uuid.UUID) -> None:
        for scheme in self.list(tenant_id):
            scheme.is_default = False
        self.db.flush()


class GradingBandRepository(BaseRepository[GradingBand]):
    model = GradingBand

    def list_by_scheme(self, tenant_id: uuid.UUID, scheme_id: uuid.UUID) -> list[GradingBand]:
        stmt = (
            select(GradingBand)
            .where(GradingBand.tenant_id == tenant_id, GradingBand.scheme_id == scheme_id)
            .order_by(GradingBand.min_percent.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def delete_by_scheme(self, tenant_id: uuid.UUID, scheme_id: uuid.UUID) -> None:
        self.db.execute(
            delete(GradingBand).where(GradingBand.tenant_id == tenant_id, GradingBand.scheme_id == scheme_id)
        )
        self.db.flush()


class ExamRepository(BaseRepository[Exam]):
    model = Exam

    def list(self, tenant_id: uuid.UUID) -> list[Exam]:
        stmt = select(Exam).where(Exam.tenant_id == tenant_id).order_by(Exam.start_date.desc(), Exam.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def count_using_scheme(self, tenant_id: uuid.UUID, scheme_id: uuid.UUID) -> int:
        stmt = select(Exam.id).where(Exam.tenant_id == tenant_id, Exam.grading_scheme_id == scheme_id)
        return len(self.db.execute(stmt).all())


class ExamClassRepository(BaseRepository[ExamClass]):
    model = ExamClass

    def list_class_ids(self, tenant_id: uuid.UUID, exam_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(ExamClass.class_grade_id).where(ExamClass.tenant_id == tenant_id, ExamClass.exam_id == exam_id)
        return [row[0] for row in self.db.execute(stmt).all()]

    def list_for_exams(self, tenant_id: uuid.UUID, exam_ids: list[uuid.UUID]) -> list[ExamClass]:
        if not exam_ids:
            return []
        stmt = select(ExamClass).where(ExamClass.tenant_id == tenant_id, ExamClass.exam_id.in_(exam_ids))
        return list(self.db.execute(stmt).scalars().all())

    def delete_for_exam(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_ids: list[uuid.UUID] | None = None) -> None:
        stmt = delete(ExamClass).where(ExamClass.tenant_id == tenant_id, ExamClass.exam_id == exam_id)
        if class_ids is not None:
            stmt = stmt.where(ExamClass.class_grade_id.in_(class_ids))
        self.db.execute(stmt)
        self.db.flush()


class ExamScheduleRepository(BaseRepository[ExamSchedule]):
    model = ExamSchedule

    def list_for_exam(
        self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_grade_id: uuid.UUID | None = None
    ) -> list[ExamSchedule]:
        stmt = select(ExamSchedule).where(ExamSchedule.tenant_id == tenant_id, ExamSchedule.exam_id == exam_id)
        if class_grade_id is not None:
            stmt = stmt.where(ExamSchedule.class_grade_id == class_grade_id)
        stmt = stmt.order_by(ExamSchedule.exam_date, ExamSchedule.start_time)
        return list(self.db.execute(stmt).scalars().all())

    def get_for_subject(
        self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_grade_id: uuid.UUID, subject_id: uuid.UUID
    ) -> ExamSchedule | None:
        stmt = select(ExamSchedule).where(
            ExamSchedule.tenant_id == tenant_id,
            ExamSchedule.exam_id == exam_id,
            ExamSchedule.class_grade_id == class_grade_id,
            ExamSchedule.subject_id == subject_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def delete_for_exam(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, class_ids: list[uuid.UUID] | None = None) -> None:
        stmt = delete(ExamSchedule).where(ExamSchedule.tenant_id == tenant_id, ExamSchedule.exam_id == exam_id)
        if class_ids is not None:
            stmt = stmt.where(ExamSchedule.class_grade_id.in_(class_ids))
        self.db.execute(stmt)
        self.db.flush()


class ExamMarkRepository(BaseRepository[ExamMark]):
    model = ExamMark

    def list_for_exam(
        self,
        tenant_id: uuid.UUID,
        exam_id: uuid.UUID,
        class_grade_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        student_id: uuid.UUID | None = None,
    ) -> list[ExamMark]:
        stmt = select(ExamMark).where(ExamMark.tenant_id == tenant_id, ExamMark.exam_id == exam_id)
        if class_grade_id is not None:
            stmt = stmt.where(ExamMark.class_grade_id == class_grade_id)
        if subject_id is not None:
            stmt = stmt.where(ExamMark.subject_id == subject_id)
        if student_id is not None:
            stmt = stmt.where(ExamMark.student_id == student_id)
        return list(self.db.execute(stmt).scalars().all())

    def delete_for_exam(
        self,
        tenant_id: uuid.UUID,
        exam_id: uuid.UUID,
        class_ids: list[uuid.UUID] | None = None,
        class_grade_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
    ) -> None:
        stmt = delete(ExamMark).where(ExamMark.tenant_id == tenant_id, ExamMark.exam_id == exam_id)
        if class_ids is not None:
            stmt = stmt.where(ExamMark.class_grade_id.in_(class_ids))
        if class_grade_id is not None:
            stmt = stmt.where(ExamMark.class_grade_id == class_grade_id)
        if subject_id is not None:
            stmt = stmt.where(ExamMark.subject_id == subject_id)
        self.db.execute(stmt)
        self.db.flush()


class ExamStudentRemarkRepository(BaseRepository[ExamStudentRemark]):
    model = ExamStudentRemark

    def get_for_student(self, tenant_id: uuid.UUID, exam_id: uuid.UUID, student_id: uuid.UUID) -> ExamStudentRemark | None:
        stmt = select(ExamStudentRemark).where(
            ExamStudentRemark.tenant_id == tenant_id,
            ExamStudentRemark.exam_id == exam_id,
            ExamStudentRemark.student_id == student_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def map_for_exam(self, tenant_id: uuid.UUID, exam_id: uuid.UUID) -> dict[uuid.UUID, str]:
        stmt = select(ExamStudentRemark).where(
            ExamStudentRemark.tenant_id == tenant_id, ExamStudentRemark.exam_id == exam_id
        )
        return {r.student_id: r.remarks for r in self.db.execute(stmt).scalars().all()}

    def delete_for_exam(self, tenant_id: uuid.UUID, exam_id: uuid.UUID) -> None:
        self.db.execute(
            delete(ExamStudentRemark).where(
                ExamStudentRemark.tenant_id == tenant_id, ExamStudentRemark.exam_id == exam_id
            )
        )
        self.db.flush()
