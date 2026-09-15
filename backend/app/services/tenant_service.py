from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import RoleEnum, User, AdminProfile
from app.repositories.tenant_repo import TenantRepository
from app.repositories.user_repo import UserRepository
from app.schemas.tenant import TenantOnboardRequest


class TenantService:
    def __init__(self, db: Session):
        self.db = db
        self.tenants = TenantRepository(db)
        self.users = UserRepository(db)

    def onboard(self, payload: TenantOnboardRequest) -> tuple[Tenant, User]:
        if self.tenants.get_by_slug(payload.slug) is not None:
            raise ConflictError(f"School slug '{payload.slug}' is already taken")

        tenant = self.tenants.create(
            Tenant(
                name=payload.school_name,
                slug=payload.slug,
                contact_email=payload.contact_email,
            )
        )

        admin_user = self.users.create(
            User(
                tenant_id=tenant.id,
                email=payload.admin_email.lower(),
                hashed_password=hash_password(payload.admin_password),
                full_name=payload.admin_full_name,
                role=RoleEnum.ADMIN,
                is_verified=False,
            )
        )
        self.db.add(AdminProfile(tenant_id=tenant.id, user_id=admin_user.id))

        self.db.commit()
        self.db.refresh(tenant)
        self.db.refresh(admin_user)
        return tenant, admin_user
