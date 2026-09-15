import uuid

from pydantic import BaseModel, EmailStr, Field


class ParentLinkCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone_number: str | None = None
    relationship_label: str | None = None


class ParentLinkOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID

    model_config = {"from_attributes": True}


class ParentPreferencesOut(BaseModel):
    whatsapp_opt_in: bool
    sms_opt_in: bool

    model_config = {"from_attributes": True}


class ParentPreferencesUpdate(BaseModel):
    whatsapp_opt_in: bool | None = None
    sms_opt_in: bool | None = None
