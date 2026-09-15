from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.tenant import TenantOnboardRequest, TenantOnboardResponse, TenantOut
from app.services.auth_service import AuthService
from app.services.tenant_service import TenantService

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("/onboard", response_model=TenantOnboardResponse, status_code=status.HTTP_201_CREATED)
def onboard(payload: TenantOnboardRequest, db: Session = Depends(get_db)) -> TenantOnboardResponse:
    tenant, admin_user = TenantService(db).onboard(payload)
    AuthService(db).send_verification_email(admin_user)
    return TenantOnboardResponse(tenant=TenantOut.model_validate(tenant), admin=admin_user)


@router.get("/me", response_model=TenantOut)
def get_my_tenant(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> TenantOut:
    from app.repositories.tenant_repo import TenantRepository

    tenant = TenantRepository(db).get_by_id(current_user.tenant_id)
    return TenantOut.model_validate(tenant)
