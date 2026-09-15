import uuid
from datetime import date

from pydantic import BaseModel, EmailStr, Field


class TeacherCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone_number: str | None = None
    employee_code: str | None = None
    hire_date: date | None = None
    qualification: str | None = None


class TeacherUpdate(BaseModel):
    full_name: str | None = None
    phone_number: str | None = None
    qualification: str | None = None
    is_active: bool | None = None


class TeacherOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: EmailStr
    phone_number: str | None
    is_active: bool
    employee_code: str | None
    hire_date: date | None
    qualification: str | None

    model_config = {"from_attributes": True}
