import uuid

from sqlalchemy.orm import Session

from app.models.student_enrollment import StudentEnrollment


class StudentEnrollmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, record: StudentEnrollment) -> StudentEnrollment:
        self.db.add(record)
        self.db.flush()
        return record

    def list_by_student(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> list[StudentEnrollment]:
        return (
            self.db.query(StudentEnrollment)
            .filter_by(tenant_id=tenant_id, student_id=student_id)
            .order_by(StudentEnrollment.enrolled_at.desc())
            .all()
        )

    def get_active(self, tenant_id: uuid.UUID, student_id: uuid.UUID) -> StudentEnrollment | None:
        return (
            self.db.query(StudentEnrollment)
            .filter_by(tenant_id=tenant_id, student_id=student_id, status="active")
            .first()
        )
