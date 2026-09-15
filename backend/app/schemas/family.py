import uuid

from pydantic import BaseModel, Field


class FamilyCreate(BaseModel):
    family_name: str = Field(min_length=1, max_length=255)
    cnic: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    notes: str | None = None


class FamilyUpdate(BaseModel):
    family_name: str | None = None
    cnic: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    notes: str | None = None


class FamilyOut(BaseModel):
    id: uuid.UUID
    family_number: str
    family_name: str
    cnic: str | None
    phone: str | None
    whatsapp_number: str | None
    notes: str | None

    model_config = {"from_attributes": True}
