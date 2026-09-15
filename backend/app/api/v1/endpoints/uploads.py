from fastapi import APIRouter, Depends, UploadFile

from app.core.dependencies import require_role
from app.models.user import RoleEnum, User
from app.services.upload_service import save_document, save_image

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/images")
def upload_image(
    file: UploadFile,
    _current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
) -> dict:
    return {"url": save_image(file)}


@router.post("/documents")
def upload_document(
    file: UploadFile,
    _current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT)),
) -> dict:
    return {"url": save_document(file)}
