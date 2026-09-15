from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.models.course import Chapter, Course, CourseEnrollment, EnrollmentStatus, TeacherAssignment
from app.repositories.base import BaseRepository


class ChapterRepository(BaseRepository[Chapter]):
    model = Chapter

    def list_by_course(self, tenant_id: uuid.UUID, course_id: uuid.UUID) -> list[Chapter]:
        stmt = (
            select(Chapter)
            .where(Chapter.tenant_id == tenant_id, Chapter.course_id == course_id)
            .order_by(Chapter.order_index, Chapter.created_at)
        )
        return list(self.db.execute(stmt).scalars().all())


class CourseRepository(BaseRepository[Course]):
    model = Course

    def list(
        self,
        tenant_id: uuid.UUID,
        academic_year_id: uuid.UUID | None = None,
        class_grade_id: uuid.UUID | None = None,
        section_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
    ) -> list[Course]:
        stmt = select(Course).where(Course.tenant_id == tenant_id)
        if academic_year_id is not None:
            stmt = stmt.where(Course.academic_year_id == academic_year_id)
        if class_grade_id is not None:
            stmt = stmt.where(Course.class_grade_id == class_grade_id)
        if section_id is not None:
            stmt = stmt.where(Course.section_id == section_id)
        if subject_id is not None:
            stmt = stmt.where(Course.subject_id == subject_id)
        stmt = stmt.order_by(Course.created_at)
        return list(self.db.execute(stmt).scalars().all())

    def list_by_ids(self, tenant_id: uuid.UUID, course_ids: list[uuid.UUID]) -> list[Course]:
        if not course_ids:
            return []
        stmt = select(Course).where(Course.tenant_id == tenant_id, Course.id.in_(course_ids))
        return list(self.db.execute(stmt).scalars().all())

    def get_by_offering(
        self, tenant_id: uuid.UUID, academic_year_id: uuid.UUID, section_id: uuid.UUID, subject_id: uuid.UUID
    ) -> Course | None:
        stmt = select(Course).where(
            Course.tenant_id == tenant_id,
            Course.academic_year_id == academic_year_id,
            Course.section_id == section_id,
            Course.subject_id == subject_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()


class TeacherAssignmentRepository(BaseRepository[TeacherAssignment]):
    model = TeacherAssignment

    def list_by_course(self, tenant_id: uuid.UUID, course_id: uuid.UUID) -> list[TeacherAssignment]:
        stmt = select(TeacherAssignment).where(
            TeacherAssignment.tenant_id == tenant_id,
            TeacherAssignment.course_id == course_id,
            TeacherAssignment.is_active.is_(True),
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_course_ids_for_teacher(self, tenant_id: uuid.UUID, teacher_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(TeacherAssignment.course_id).where(
            TeacherAssignment.tenant_id == tenant_id,
            TeacherAssignment.teacher_id == teacher_id,
            TeacherAssignment.is_active.is_(True),
        )
        return [row[0] for row in self.db.execute(stmt).all()]

    def get_active(self, tenant_id: uuid.UUID, course_id: uuid.UUID, teacher_id: uuid.UUID) -> TeacherAssignment | None:
        stmt = select(TeacherAssignment).where(
            TeacherAssignment.tenant_id == tenant_id,
            TeacherAssignment.course_id == course_id,
            TeacherAssignment.teacher_id == teacher_id,
            TeacherAssignment.is_active.is_(True),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_any(self, tenant_id: uuid.UUID, course_id: uuid.UUID, teacher_id: uuid.UUID) -> TeacherAssignment | None:
        """Regardless of is_active — used to reactivate a previously-removed assignment instead
        of violating the (course_id, teacher_id) unique constraint with a duplicate row."""
        stmt = select(TeacherAssignment).where(
            TeacherAssignment.tenant_id == tenant_id,
            TeacherAssignment.course_id == course_id,
            TeacherAssignment.teacher_id == teacher_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def is_teacher_assigned(self, tenant_id: uuid.UUID, course_id: uuid.UUID, teacher_id: uuid.UUID) -> bool:
        return self.get_active(tenant_id, course_id, teacher_id) is not None


class CourseEnrollmentRepository(BaseRepository[CourseEnrollment]):
    model = CourseEnrollment

    def list_by_course(self, tenant_id: uuid.UUID, course_id: uuid.UUID) -> list[CourseEnrollment]:
        stmt = select(CourseEnrollment).where(
            CourseEnrollment.tenant_id == tenant_id,
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.status == EnrollmentStatus.ACTIVE,
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_course_ids_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(CourseEnrollment.course_id).where(
            CourseEnrollment.tenant_id == tenant_id,
            CourseEnrollment.student_id == student_id,
            CourseEnrollment.status == EnrollmentStatus.ACTIVE,
        )
        return [row[0] for row in self.db.execute(stmt).all()]

    def get_active(self, tenant_id: uuid.UUID, course_id: uuid.UUID, student_id: uuid.UUID) -> CourseEnrollment | None:
        stmt = select(CourseEnrollment).where(
            CourseEnrollment.tenant_id == tenant_id,
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.student_id == student_id,
            CourseEnrollment.status == EnrollmentStatus.ACTIVE,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_any(self, tenant_id: uuid.UUID, course_id: uuid.UUID, student_id: uuid.UUID) -> CourseEnrollment | None:
        """Regardless of status — used to reactivate a dropped enrollment instead of violating
        the (course_id, student_id) unique constraint with a duplicate row."""
        stmt = select(CourseEnrollment).where(
            CourseEnrollment.tenant_id == tenant_id,
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.student_id == student_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def count_active_by_course(self, tenant_id: uuid.UUID, course_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not course_ids:
            return {}
        stmt = (
            select(CourseEnrollment.course_id, func.count(CourseEnrollment.id))
            .where(
                CourseEnrollment.tenant_id == tenant_id,
                CourseEnrollment.course_id.in_(course_ids),
                CourseEnrollment.status == EnrollmentStatus.ACTIVE,
            )
            .group_by(CourseEnrollment.course_id)
        )
        return {row[0]: row[1] for row in self.db.execute(stmt).all()}
