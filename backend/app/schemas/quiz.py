import uuid
from datetime import datetime

from pydantic import BaseModel, Field, computed_field, model_validator

from app.core.grading_scale import letter_grade
from app.models.quiz import AttemptStatus, QuestionType


class OptionCreate(BaseModel):
    option_text: str = Field(min_length=1, max_length=500)
    is_correct: bool = False


class QuestionCreate(BaseModel):
    question_text: str = Field(min_length=1)
    question_type: QuestionType
    marks: float = Field(default=1, gt=0)
    options: list[OptionCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_options(self) -> "QuestionCreate":
        if self.question_type == QuestionType.SHORT_ANSWER:
            if self.options:
                raise ValueError("Short-answer questions don't take options")
            return self
        if self.question_type == QuestionType.TRUE_FALSE and len(self.options) != 2:
            raise ValueError("True/False questions must have exactly 2 options")
        if len(self.options) < 2:
            raise ValueError("Each question needs at least 2 options")
        if sum(1 for o in self.options if o.is_correct) != 1:
            raise ValueError("Each question must have exactly one correct option")
        return self


class QuizCreate(BaseModel):
    section_id: uuid.UUID
    subject_id: uuid.UUID
    chapter_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    time_limit_minutes: int | None = Field(default=None, gt=0)
    due_date: datetime | None = None
    questions: list[QuestionCreate] = Field(min_length=1)


class QuizUpdate(BaseModel):
    is_published: bool | None = None


class QuizOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    chapter_id: uuid.UUID | None
    title: str
    description: str | None
    time_limit_minutes: int | None
    due_date: datetime | None
    is_published: bool

    model_config = {"from_attributes": True}


class OptionOut(BaseModel):
    id: uuid.UUID
    option_text: str
    order_index: int


class QuestionOut(BaseModel):
    id: uuid.UUID
    question_text: str
    question_type: QuestionType
    order_index: int
    marks: float
    options: list[OptionOut]


class QuizTakeOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    time_limit_minutes: int | None
    due_date: datetime | None
    questions: list[QuestionOut]


class AnswerIn(BaseModel):
    question_id: uuid.UUID
    selected_option_id: uuid.UUID | None = None
    answer_text: str | None = None


class SubmitAttemptRequest(BaseModel):
    answers: list[AnswerIn]


def _percentage(score: float | None, max_score: float) -> float | None:
    if score is None or max_score <= 0:
        return None
    return round((score / max_score) * 100, 1)


class AttemptOut(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    student_id: uuid.UUID
    started_at: datetime
    submitted_at: datetime | None
    score: float | None
    max_score: float
    status: AttemptStatus

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def percentage(self) -> float | None:
        return _percentage(self.score, self.max_score)

    @computed_field
    @property
    def grade(self) -> str | None:
        pct = _percentage(self.score, self.max_score)
        return letter_grade(pct) if pct is not None else None


class MyAttemptHistoryEntry(AttemptOut):
    quiz_title: str


class OptionWithAnswerOut(OptionOut):
    is_correct: bool


class QuestionReviewOut(BaseModel):
    id: uuid.UUID
    question_text: str
    question_type: QuestionType
    order_index: int
    marks: float
    options: list[OptionWithAnswerOut]
    selected_option_id: uuid.UUID | None
    answer_text: str | None
    marks_awarded: float | None
    is_correct: bool | None


class AttemptReviewOut(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    score: float | None
    max_score: float
    status: AttemptStatus
    questions: list[QuestionReviewOut]

    @computed_field
    @property
    def percentage(self) -> float | None:
        return _percentage(self.score, self.max_score)

    @computed_field
    @property
    def grade(self) -> str | None:
        pct = _percentage(self.score, self.max_score)
        return letter_grade(pct) if pct is not None else None


class ResultEntry(BaseModel):
    attempt_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    score: float | None
    max_score: float
    status: AttemptStatus
    submitted_at: datetime | None
    needs_grading: bool

    @computed_field
    @property
    def percentage(self) -> float | None:
        return _percentage(self.score, self.max_score)

    @computed_field
    @property
    def grade(self) -> str | None:
        pct = _percentage(self.score, self.max_score)
        return letter_grade(pct) if pct is not None else None


class GradeAnswerIn(BaseModel):
    question_id: uuid.UUID
    marks_awarded: float = Field(ge=0)


class GradeAttemptRequest(BaseModel):
    answers: list[GradeAnswerIn] = Field(min_length=1)
