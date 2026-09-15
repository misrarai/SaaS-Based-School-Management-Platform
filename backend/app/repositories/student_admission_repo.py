import uuid

from sqlalchemy import select

from app.models.student_admission_detail import StudentAdmissionDetail
from app.repositories.base import BaseRepository


class StudentAdmissionDetailRepository(BaseRepository[StudentAdmissionDetail]):
    model = StudentAdmissionDetail

    def get_by_student_id(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> StudentAdmissionDetail | None:
        stmt = select(StudentAdmissionDetail).where(
            StudentAdmissionDetail.tenant_id == tenant_id, StudentAdmissionDetail.student_id == student_id
        )
        return self.db.execute(stmt).scalar_one_or_none()
