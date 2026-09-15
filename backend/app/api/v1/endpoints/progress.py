import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import ForbiddenError
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.progress import ProgressOut
from app.services.parent_service import ParentService
from app.services.progress_service import ProgressService

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/students/{student_id}", response_model=ProgressOut)
def get_progress(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> ProgressOut:
    tenant_id = current_user.tenant_id

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None or profile.id != student_id:
            raise ForbiddenError("Not your progress")
    elif current_user.role == RoleEnum.PARENT:
        ParentService(db).assert_child(tenant_id, current_user.id, student_id)

    return ProgressService(db).get_progress(tenant_id, student_id)
