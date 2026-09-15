import uuid

from sqlalchemy import select

from app.models.assignment import Assignment, AssignmentSubmission
from app.repositories.base import BaseRepository


class AssignmentRepository(BaseRepository[Assignment]):
    model = Assignment

    def list_assignments(
        self,
        tenant_id: uuid.UUID,
        section_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        teacher_id: uuid.UUID | None = None,
    ) -> list[Assignment]:
        stmt = select(Assignment).where(Assignment.tenant_id == tenant_id)
        if section_id is not None:
            stmt = stmt.where(Assignment.section_id == section_id)
        if subject_id is not None:
            stmt = stmt.where(Assignment.subject_id == subject_id)
        if teacher_id is not None:
            stmt = stmt.where(Assignment.teacher_id == teacher_id)
        stmt = stmt.order_by(Assignment.due_date.desc())
        return list(self.db.execute(stmt).scalars().all())


class AssignmentSubmissionRepository(BaseRepository[AssignmentSubmission]):
    model = AssignmentSubmission

    def get_for_assignment_student(
        self, tenant_id: uuid.UUID, assignment_id: uuid.UUID, student_id: uuid.UUID
    ) -> AssignmentSubmission | None:
        stmt = select(AssignmentSubmission).where(
            AssignmentSubmission.tenant_id == tenant_id,
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.student_id == student_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_assignment(self, tenant_id: uuid.UUID, assignment_id: uuid.UUID) -> list[AssignmentSubmission]:
        stmt = select(AssignmentSubmission).where(
            AssignmentSubmission.tenant_id == tenant_id, AssignmentSubmission.assignment_id == assignment_id
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_for_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[AssignmentSubmission]:
        stmt = select(AssignmentSubmission).where(
            AssignmentSubmission.tenant_id == tenant_id, AssignmentSubmission.student_id == student_id
        )
        return list(self.db.execute(stmt).scalars().all())
