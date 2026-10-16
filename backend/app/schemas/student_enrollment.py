import uuid
from datetime import date

from pydantic import BaseModel


class StudentEnrollmentOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    class_grade_id: uuid.UUID
    section_id: uuid.UUID | None
    academic_year_id: uuid.UUID | None
    enrolled_at: date
    left_at: date | None
    status: str
    notes: str | None

    model_config = {"from_attributes": True}
