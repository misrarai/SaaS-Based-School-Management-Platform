import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AssignmentCreate(BaseModel):
    section_id: uuid.UUID
    subject_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    instructions_file_url: str | None = None
    due_date: datetime
    max_marks: float | None = Field(default=None, gt=0)


class AssignmentOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    title: str
    description: str | None
    instructions_file_url: str | None
    due_date: datetime
    max_marks: float | None

    model_config = {"from_attributes": True}


class SubmissionCreate(BaseModel):
    file_url: str


class SubmissionOut(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    submitted_file_url: str | None
    submitted_at: datetime | None
    is_late: bool
    marks_obtained: float | None
    teacher_feedback: str | None
    graded_by_user_id: uuid.UUID | None
    graded_at: datetime | None

    model_config = {"from_attributes": True}


class GradeSubmissionRequest(BaseModel):
    marks_obtained: float = Field(ge=0)
    teacher_feedback: str | None = None


class GradebookEntry(BaseModel):
    assignment_id: uuid.UUID
    assignment_title: str
    subject_id: uuid.UUID
    max_marks: float | None
    marks_obtained: float | None
    due_date: datetime
    graded_at: datetime | None


class SubjectPerformanceEntry(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    average_percent: float | None
