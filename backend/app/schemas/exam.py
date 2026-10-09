import uuid
from datetime import date, time

from pydantic import BaseModel, Field, model_validator


# ---------- Grading schemes ----------
class GradingBandIn(BaseModel):
    min_percent: float = Field(ge=0, le=100)
    max_percent: float = Field(ge=0, le=100)
    grade: str = Field(min_length=1, max_length=10)
    gpa: float | None = Field(default=None, ge=0, le=10)
    remarks: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def _check_range(self):
        if self.min_percent > self.max_percent:
            raise ValueError("min_percent must not exceed max_percent")
        return self


class GradingBandOut(GradingBandIn):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class GradingSchemeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    is_default: bool = False
    bands: list[GradingBandIn] = Field(min_length=1)


class GradingSchemeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_default: bool | None = None
    bands: list[GradingBandIn] | None = Field(default=None, min_length=1)


class GradingSchemeOut(BaseModel):
    id: uuid.UUID
    name: str
    is_default: bool
    bands: list[GradingBandOut]


# ---------- Exams ----------
class ExamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    academic_year: str | None = Field(default=None, max_length=20)
    academic_year_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    grading_scheme_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=500)
    class_grade_ids: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class ExamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    academic_year: str | None = Field(default=None, max_length=20)
    academic_year_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    grading_scheme_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=500)
    status: str | None = Field(default=None, pattern="^(draft|published)$")
    class_grade_ids: list[uuid.UUID] | None = None


class ExamClassOut(BaseModel):
    class_grade_id: uuid.UUID
    class_name: str


class ExamOut(BaseModel):
    id: uuid.UUID
    name: str
    academic_year: str | None
    academic_year_id: uuid.UUID | None
    start_date: date | None
    end_date: date | None
    grading_scheme_id: uuid.UUID | None
    grading_scheme_name: str | None = None
    status: str
    results_published: bool
    description: str | None
    classes: list[ExamClassOut] = []


class PublishResultsRequest(BaseModel):
    published: bool


# ---------- Datesheet ----------
class DatesheetEntryIn(BaseModel):
    subject_id: uuid.UUID
    exam_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    total_marks: float = Field(gt=0, le=10000)
    passing_marks: float = Field(ge=0, le=10000)
    room: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def _check(self):
        if self.passing_marks > self.total_marks:
            raise ValueError("passing_marks must not exceed total_marks")
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class DatesheetSave(BaseModel):
    class_grade_id: uuid.UUID
    entries: list[DatesheetEntryIn]


class DatesheetEntryOut(BaseModel):
    id: uuid.UUID
    class_grade_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_name: str
    subject_code: str
    exam_date: date | None
    start_time: time | None
    end_time: time | None
    total_marks: float
    passing_marks: float
    room: str | None


# ---------- Marks ----------
class MarkEntryIn(BaseModel):
    student_id: uuid.UUID
    obtained_marks: float | None = Field(default=None, ge=0)
    is_absent: bool = False
    remarks: str | None = Field(default=None, max_length=255)


class MarksSave(BaseModel):
    class_grade_id: uuid.UUID
    section_id: uuid.UUID | None = None
    subject_id: uuid.UUID
    entries: list[MarkEntryIn]


class MarkRowOut(BaseModel):
    student_id: uuid.UUID
    full_name: str
    roll_number: str | None
    admission_number: str | None
    section_id: uuid.UUID | None
    obtained_marks: float | None
    is_absent: bool
    remarks: str | None


class MarksSheetOut(BaseModel):
    exam_id: uuid.UUID
    class_grade_id: uuid.UUID
    section_id: uuid.UUID | None
    subject_id: uuid.UUID
    subject_name: str
    total_marks: float
    passing_marks: float
    locked: bool
    rows: list[MarkRowOut]


class TeacherSubjectOut(BaseModel):
    class_grade_id: uuid.UUID
    class_name: str
    section_id: uuid.UUID
    section_name: str
    subject_id: uuid.UUID
    subject_name: str


# ---------- Results ----------
class SubjectHeaderOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    subject_code: str
    total_marks: float
    passing_marks: float


class SubjectResultOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    total_marks: float
    passing_marks: float
    obtained_marks: float | None
    is_absent: bool
    grade: str | None
    passed: bool
    remarks: str | None


class StudentResultOut(BaseModel):
    student_id: uuid.UUID
    full_name: str
    roll_number: str | None
    admission_number: str | None
    section_id: uuid.UUID | None
    section_name: str | None
    subjects: list[SubjectResultOut]
    total_obtained: float
    total_marks: float
    percentage: float
    grade: str | None
    gpa: float | None
    grade_remarks: str | None
    passed: bool
    position: int | None
    section_position: int | None
    remarks: str | None


class TabulationOut(BaseModel):
    exam_id: uuid.UUID
    exam_name: str
    class_grade_id: uuid.UUID
    class_name: str
    section_id: uuid.UUID | None
    results_published: bool
    subjects: list[SubjectHeaderOut]
    rows: list[StudentResultOut]


class StudentExamResultOut(BaseModel):
    exam_id: uuid.UUID
    exam_name: str
    academic_year: str | None
    start_date: date | None
    end_date: date | None
    class_name: str
    class_strength: int
    result: StudentResultOut


class StudentRemarkSave(BaseModel):
    remarks: str = Field(max_length=500)


class MyExamOut(BaseModel):
    exam_id: uuid.UUID
    student_id: uuid.UUID
    exam_name: str
    academic_year: str | None
    start_date: date | None
    end_date: date | None
    status: str
    results_published: bool
    percentage: float | None = None
    grade: str | None = None
    position: int | None = None
    passed: bool | None = None
