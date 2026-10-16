import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

STATUS_PATTERN = r"^(open|closed)$"
STAGE_PATTERN = r"^(applied|shortlisted|interview|offered|hired|rejected)$"
RESULT_PATTERN = r"^(pending|pass|fail)$"


class VacancyCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    department: str | None = Field(default=None, max_length=150)
    description: str | None = None
    positions: int = Field(default=1, ge=1)
    posted_date: date | None = None


class VacancyUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=150)
    department: str | None = None
    description: str | None = None
    positions: int | None = Field(default=None, ge=1)
    status: str | None = Field(default=None, pattern=STATUS_PATTERN)


class VacancyOut(BaseModel):
    id: uuid.UUID
    title: str
    department: str | None
    description: str | None
    positions: int
    posted_date: date
    status: str
    application_count: int = 0
    hired_count: int = 0

    model_config = {"from_attributes": True}


class ApplicationCreate(BaseModel):
    vacancy_id: uuid.UUID
    candidate_name: str = Field(min_length=1, max_length=150)
    email: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    qualification: str | None = Field(default=None, max_length=255)
    experience_years: int | None = Field(default=None, ge=0)
    resume_url: str | None = None
    notes: str | None = None


class ApplicationUpdate(BaseModel):
    stage: str | None = Field(default=None, pattern=STAGE_PATTERN)
    interview_at: datetime | None = None
    interviewer: str | None = Field(default=None, max_length=150)
    interview_result: str | None = Field(default=None, pattern=RESULT_PATTERN)
    interview_feedback: str | None = None
    notes: str | None = None


class ApplicationOut(BaseModel):
    id: uuid.UUID
    vacancy_id: uuid.UUID
    vacancy_title: str | None
    candidate_name: str
    email: str | None
    phone: str | None
    qualification: str | None
    experience_years: int | None
    resume_url: str | None
    applied_date: date
    stage: str
    interview_at: datetime | None
    interviewer: str | None
    interview_result: str | None
    interview_feedback: str | None
    notes: str | None

    model_config = {"from_attributes": True}
