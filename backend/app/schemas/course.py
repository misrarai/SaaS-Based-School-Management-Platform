import uuid
from datetime import date

from pydantic import BaseModel, EmailStr, Field

from app.models.course import EnrollmentStatus
from app.schemas.quiz import QuizOut
from app.schemas.resource import ResourceOut


class CourseCreate(BaseModel):
    academic_year_id: uuid.UUID
    section_id: uuid.UUID
    subject_id: uuid.UUID


class CourseTeacherSummary(BaseModel):
    teacher_id: uuid.UUID
    full_name: str
    email: EmailStr


class CourseOut(BaseModel):
    id: uuid.UUID
    academic_year_id: uuid.UUID
    academic_year_name: str
    class_grade_id: uuid.UUID
    class_grade_name: str
    section_id: uuid.UUID
    section_name: str
    subject_id: uuid.UUID
    subject_name: str
    is_active: bool
    teachers: list[CourseTeacherSummary]
    student_count: int


class TeacherAssignmentCreate(BaseModel):
    teacher_id: uuid.UUID


class TeacherAssignmentOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    teacher_id: uuid.UUID
    full_name: str
    email: EmailStr
    assigned_date: date
    is_active: bool


class CourseEnrollmentCreate(BaseModel):
    student_id: uuid.UUID


class CourseEnrollmentOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    student_id: uuid.UUID
    full_name: str
    email: EmailStr
    enrolled_date: date
    status: EnrollmentStatus


class TeacherStudentSummary(BaseModel):
    """One row per student in a teacher's My Students roster — a student can be in more than
    one of the teacher's courses (e.g. two subjects, same section), so subjects is a list
    rather than the roster containing one duplicate row per course."""

    student_id: uuid.UUID
    full_name: str
    email: EmailStr
    class_grade_name: str
    section_name: str
    subjects: list[str]


class CourseGradebookRow(BaseModel):
    student_id: uuid.UUID
    full_name: str
    email: EmailStr
    assignments_graded: int
    average_percent: float | None


class ChapterCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    order_index: int = 0


class ChapterUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    order_index: int | None = None


class ChapterOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: str | None
    order_index: int

    model_config = {"from_attributes": True}


class ChapterContentOut(BaseModel):
    """What a student sees when they open a chapter — its video/notes/worksheet resources
    plus any quiz, in one call."""

    chapter: ChapterOut
    resources: list[ResourceOut]
    quizzes: list[QuizOut]
