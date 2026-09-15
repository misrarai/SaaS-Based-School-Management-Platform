import uuid

from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import UserOut


class TenantOnboardRequest(BaseModel):
    school_name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    contact_email: EmailStr
    admin_full_name: str = Field(min_length=2, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)


class TenantOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    contact_email: EmailStr
    is_active: bool
    plan: str

    model_config = {"from_attributes": True}


class TenantOnboardResponse(BaseModel):
    tenant: TenantOut
    admin: UserOut
