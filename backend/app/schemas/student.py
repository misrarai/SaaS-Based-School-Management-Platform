import uuid
from datetime import date

from pydantic import BaseModel, EmailStr, Field

from app.schemas.student_admission_detail import StudentAdmissionDetailIn, StudentAdmissionDetailOut


class StudentCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    class_grade_id: uuid.UUID
    section_id: uuid.UUID | None = None
    family_id: uuid.UUID | None = None
    roll_number: str | None = None
    admission_date: date | None = None
    date_of_birth: date | None = None
    guardian_name: str | None = None
    admission_detail: StudentAdmissionDetailIn | None = None


class StudentUpdate(BaseModel):
    full_name: str | None = None
    class_grade_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    family_id: uuid.UUID | None = None
    roll_number: str | None = None
    status: str | None = None
    is_active: bool | None = None
    admission_detail: StudentAdmissionDetailIn | None = None


class StudentWithdrawRequest(BaseModel):
    reason: str | None = None
    withdrawal_date: date | None = None


class StudentOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: EmailStr
    is_active: bool
    class_grade_id: uuid.UUID | None
    section_id: uuid.UUID | None
    family_id: uuid.UUID | None
    admission_number: str | None
    roll_number: str | None
    admission_date: date | None
    date_of_birth: date | None
    guardian_name: str | None
    status: str
    withdrawal_date: date | None
    withdrawal_reason: str | None
    admission_detail: StudentAdmissionDetailOut | None = None

    model_config = {"from_attributes": True}
