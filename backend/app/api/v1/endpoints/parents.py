from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.parent import ParentPreferencesOut, ParentPreferencesUpdate
from app.schemas.student import StudentOut
from app.services.parent_service import ParentService
from app.services.student_service import StudentService

router = APIRouter(prefix="/parents", tags=["parents"])


@router.get("/me/children", response_model=list[StudentOut])
def list_my_children(
    current_user: User = Depends(require_role(RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[StudentOut]:
    tenant_id = current_user.tenant_id
    children = ParentService(db).list_children_profiles(tenant_id, current_user.id)
    return StudentService(db).get_students_by_ids(tenant_id, [c.id for c in children])


@router.get("/me/preferences", response_model=ParentPreferencesOut)
def get_my_preferences(
    current_user: User = Depends(require_role(RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> ParentPreferencesOut:
    return ParentService(db).get_preferences(current_user.tenant_id, current_user.id)


@router.patch("/me/preferences", response_model=ParentPreferencesOut)
def update_my_preferences(
    payload: ParentPreferencesUpdate,
    current_user: User = Depends(require_role(RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> ParentPreferencesOut:
    return ParentService(db).update_preferences(
        current_user.tenant_id, current_user.id, payload.whatsapp_opt_in, payload.sms_opt_in
    )
