"""Super Admin endpoints — platform-level management of tenants (schools) and their admins."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_super_admin
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.user import AdminProfile, RoleEnum, User
from app.models.mixins import GUID
from app.repositories.tenant_repo import TenantRepository
from app.repositories.user_repo import UserRepository

router = APIRouter(prefix="/super-admin", tags=["super-admin"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TenantOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    contact_email: str
    is_active: bool
    plan: str
    created_at: datetime
    admin_count: int = 0

    model_config = {"from_attributes": True}


class CreateTenantRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9\-]+$")
    contact_email: EmailStr
    plan: str = "trial"
    admin_full_name: str = Field(min_length=2, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)


class UpdateTenantRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    contact_email: EmailStr | None = None
    plan: str | None = None
    is_active: bool | None = None


class SchoolAdminOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    is_active: bool

    model_config = {"from_attributes": True}


class CreateSchoolAdminRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


# ── Tenant endpoints ─────────────────────────────────────────────────────────

@router.get("/tenants", response_model=list[TenantOut])
def list_tenants(
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[TenantOut]:
    tenants = db.execute(select(Tenant).order_by(Tenant.created_at.desc())).scalars().all()
    result = []
    for t in tenants:
        admin_count = db.execute(
            select(func.count()).select_from(User).where(
                User.tenant_id == t.id, User.role == RoleEnum.ADMIN
            )
        ).scalar_one()
        result.append(TenantOut(
            id=t.id,
            name=t.name,
            slug=t.slug,
            contact_email=t.contact_email,
            is_active=t.is_active,
            plan=t.plan,
            created_at=t.created_at,
            admin_count=admin_count,
        ))
    return result


@router.post("/tenants", response_model=TenantOut, status_code=201)
def create_tenant(
    payload: CreateTenantRequest,
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> TenantOut:
    tenant_repo = TenantRepository(db)
    user_repo = UserRepository(db)

    if tenant_repo.get_by_slug(payload.slug):
        raise ConflictError(f"School with slug '{payload.slug}' already exists")

    # Create tenant
    tenant = Tenant(
        name=payload.name,
        slug=payload.slug,
        contact_email=str(payload.contact_email),
        plan=payload.plan,
        is_active=True,
    )
    tenant_repo.create(tenant)

    # Check admin email uniqueness within new tenant
    if user_repo.get_by_email(tenant.id, str(payload.admin_email)):
        raise ConflictError("Admin email already exists in this school")

    # Create school admin user
    admin_user = User(
        tenant_id=tenant.id,
        email=str(payload.admin_email).lower(),
        hashed_password=hash_password(payload.admin_password),
        full_name=payload.admin_full_name,
        role=RoleEnum.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db.add(admin_user)
    db.flush()

    admin_profile = AdminProfile(tenant_id=tenant.id, user_id=admin_user.id)
    db.add(admin_profile)
    db.commit()

    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        contact_email=tenant.contact_email,
        is_active=tenant.is_active,
        plan=tenant.plan,
        created_at=tenant.created_at,
        admin_count=1,
    )


@router.patch("/tenants/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: uuid.UUID,
    payload: UpdateTenantRequest,
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> TenantOut:
    tenant_repo = TenantRepository(db)
    tenant = tenant_repo.get_by_id(tenant_id)
    if not tenant:
        raise NotFoundError("School not found")

    if payload.name is not None:
        tenant.name = payload.name
    if payload.contact_email is not None:
        tenant.contact_email = str(payload.contact_email)
    if payload.plan is not None:
        tenant.plan = payload.plan
    if payload.is_active is not None:
        tenant.is_active = payload.is_active

    db.commit()
    db.refresh(tenant)

    admin_count = db.execute(
        select(func.count()).select_from(User).where(
            User.tenant_id == tenant.id, User.role == RoleEnum.ADMIN
        )
    ).scalar_one()

    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        contact_email=tenant.contact_email,
        is_active=tenant.is_active,
        plan=tenant.plan,
        created_at=tenant.created_at,
        admin_count=admin_count,
    )


# ── School admin management ───────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/admins", response_model=list[SchoolAdminOut])
def list_school_admins(
    tenant_id: uuid.UUID,
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[SchoolAdminOut]:
    users = db.execute(
        select(User).where(User.tenant_id == tenant_id, User.role == RoleEnum.ADMIN)
    ).scalars().all()
    return [SchoolAdminOut(id=u.id, full_name=u.full_name, email=u.email, is_active=u.is_active) for u in users]


@router.post("/tenants/{tenant_id}/admins", response_model=SchoolAdminOut, status_code=201)
def create_school_admin(
    tenant_id: uuid.UUID,
    payload: CreateSchoolAdminRequest,
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> SchoolAdminOut:
    tenant_repo = TenantRepository(db)
    user_repo = UserRepository(db)

    tenant = tenant_repo.get_by_id(tenant_id)
    if not tenant:
        raise NotFoundError("School not found")

    if user_repo.get_by_email(tenant_id, str(payload.email)):
        raise ConflictError("Email already exists in this school")

    admin_user = User(
        tenant_id=tenant_id,
        email=str(payload.email).lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=RoleEnum.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db.add(admin_user)
    db.flush()

    admin_profile = AdminProfile(tenant_id=tenant_id, user_id=admin_user.id)
    db.add(admin_profile)
    db.commit()

    return SchoolAdminOut(id=admin_user.id, full_name=admin_user.full_name, email=admin_user.email, is_active=admin_user.is_active)


@router.patch("/tenants/{tenant_id}/admins/{user_id}/toggle-active", response_model=SchoolAdminOut)
def toggle_admin_active(
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> SchoolAdminOut:
    user = db.execute(
        select(User).where(User.id == user_id, User.tenant_id == tenant_id, User.role == RoleEnum.ADMIN)
    ).scalar_one_or_none()
    if not user:
        raise NotFoundError("Admin user not found")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return SchoolAdminOut(id=user.id, full_name=user.full_name, email=user.email, is_active=user.is_active)


# ── Platform stats ────────────────────────────────────────────────────────────

class PlatformStats(BaseModel):
    total_schools: int
    active_schools: int
    total_users: int


@router.get("/stats", response_model=PlatformStats)
def platform_stats(
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PlatformStats:
    total_schools = db.execute(select(func.count()).select_from(Tenant)).scalar_one()
    active_schools = db.execute(select(func.count()).select_from(Tenant).where(Tenant.is_active == True)).scalar_one()  # noqa: E712
    total_users = db.execute(select(func.count()).select_from(User).where(User.role != RoleEnum.SUPER_ADMIN)).scalar_one()
    return PlatformStats(total_schools=total_schools, active_schools=active_schools, total_users=total_users)
