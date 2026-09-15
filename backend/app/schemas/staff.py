import uuid
from datetime import date

from pydantic import BaseModel, Field


class StaffCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    designation: str = Field(min_length=1, max_length=100)
    phone: str | None = None
    whatsapp_number: str | None = None
    salary: float | None = None
    hire_date: date | None = None
    notes: str | None = None


class StaffUpdate(BaseModel):
    full_name: str | None = None
    designation: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    salary: float | None = None
    hire_date: date | None = None
    notes: str | None = None


class StaffStatusUpdate(BaseModel):
    status: str = Field(pattern="^(active|inactive)$")


class StaffOut(BaseModel):
    id: uuid.UUID
    employee_code: str
    full_name: str
    designation: str
    phone: str | None
    whatsapp_number: str | None
    salary: float | None
    status: str
    hire_date: date | None
    notes: str | None

    model_config = {"from_attributes": True}
