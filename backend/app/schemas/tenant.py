import uuid
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import UserOut


class TenantOnboardRequest(BaseModel):
    school_name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    contact_email: EmailStr
    admin_full_name: str = Field(min_length=2, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    contact_email: Optional[EmailStr] = None
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    bank_name: Optional[str] = Field(None, max_length=255)
    bank_account_title: Optional[str] = Field(None, max_length=255)
    bank_account_number: Optional[str] = Field(None, max_length=100)
    bank_iban: Optional[str] = Field(None, max_length=100)
    bank_branch: Optional[str] = Field(None, max_length=255)


class TenantOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    contact_email: EmailStr
    is_active: bool
    plan: str
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_title: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_branch: Optional[str] = None

    model_config = {"from_attributes": True}


class TenantOnboardResponse(BaseModel):
    tenant: TenantOut
    admin: UserOut
