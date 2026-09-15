import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.notification import NotificationLogOut, SendReportCardEmailRequest
from app.schemas.parent import ParentLinkCreate, ParentLinkOut
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate, StudentWithdrawRequest
from app.schemas.student_import import StudentImportResult
from app.services.document_service import DocumentService
from app.services.notification_service import NotificationService
from app.services.parent_service import ParentService
from app.services.student_import_service import StudentImportService, build_sample_template
from app.services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["students"])


@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> StudentOut:
    return StudentService(db).create_student(current_user.tenant_id, payload)


@router.get("", response_model=list[StudentOut])
def list_students(
    class_grade_id: uuid.UUID | None = Query(default=None),
    section_id: uuid.UUID | None = Query(default=None),
    family_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[StudentOut]:
    return StudentService(db).list_students(
        current_user.tenant_id, class_grade_id, section_id, family_id, status_filter, q
    )


@router.get("/next-admission-number")
def get_next_admission_number(
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> dict:
    return {"next_admission_number": StudentService(db).preview_next_admission_number(current_user.tenant_id)}


@router.get("/import/sample")
def download_import_sample(
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
) -> StreamingResponse:
    buffer = build_sample_template()
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=student_import_sample.xlsx"},
    )


@router.post("/import", response_model=StudentImportResult)
def import_students(
    class_grade_id: uuid.UUID,
    file: UploadFile,
    section_id: uuid.UUID | None = None,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> StudentImportResult:
    return StudentImportService(db).import_from_excel(current_user.tenant_id, class_grade_id, section_id, file)


@router.get("/me", response_model=StudentOut)
def get_my_student_profile(
    current_user: User = Depends(require_role(RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> StudentOut:
    return StudentService(db).get_current_student(current_user.tenant_id, current_user.id)


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> StudentOut:
    return StudentService(db).get_student(current_user.tenant_id, student_id)


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: uuid.UUID,
    payload: StudentUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StudentOut:
    return StudentService(db).update_student(current_user.tenant_id, student_id, payload)


@router.post("/{student_id}/withdraw", response_model=StudentOut)
def withdraw_student(
    student_id: uuid.UUID,
    payload: StudentWithdrawRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StudentOut:
    return StudentService(db).withdraw_student(current_user.tenant_id, student_id, payload.reason, payload.withdrawal_date)


@router.post("/{student_id}/reactivate", response_model=StudentOut)
def reactivate_student(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> StudentOut:
    return StudentService(db).reactivate_student(current_user.tenant_id, student_id)


@router.post("/{student_id}/parents", response_model=ParentLinkOut, status_code=status.HTTP_201_CREATED)
def link_parent(
    student_id: uuid.UUID,
    payload: ParentLinkCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> ParentLinkOut:
    return ParentService(db).create_and_link_parent(current_user.tenant_id, student_id, payload)


def _assert_can_view_documents(db: Session, current_user: User, student_id: uuid.UUID) -> None:
    """ADMIN/TEACHER can view any student's documents; STUDENT/PARENT only their own/their
    child's — same ownership pattern used for invoices in fees.py."""
    tenant_id = current_user.tenant_id
    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None or profile.id != student_id:
            raise ForbiddenError("Not your document")
    elif current_user.role == RoleEnum.PARENT:
        ParentService(db).assert_child(tenant_id, current_user.id, student_id)


@router.get("/{student_id}/report-card")
def get_report_card(
    student_id: uuid.UUID,
    period_month: int | None = Query(default=None, ge=1, le=12),
    period_year: int | None = Query(default=None, ge=2000, le=2100),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _assert_can_view_documents(db, current_user, student_id)
    now = datetime.now(timezone.utc)
    pdf_bytes = DocumentService(db).generate_report_card(
        current_user.tenant_id, student_id, period_month or now.month, period_year or now.year
    )
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=report-card.pdf"},
    )


@router.post("/{student_id}/report-card/email", response_model=list[NotificationLogOut])
def email_report_card(
    student_id: uuid.UUID,
    payload: SendReportCardEmailRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> list[NotificationLogOut]:
    tenant_id = current_user.tenant_id
    now = datetime.now(timezone.utc)
    period_month = payload.period_month or now.month
    period_year = payload.period_year or now.year

    found = StudentProfileRepository(db).get_with_user(tenant_id, student_id)
    if found is None:
        raise NotFoundError("Student not found")
    _profile, student_user = found

    pdf_bytes = DocumentService(db).generate_report_card(tenant_id, student_id, period_month, period_year)
    return NotificationService(db).send_report_card_email(
        tenant_id,
        student_id,
        student_user.full_name,
        date(period_year, period_month, 1).strftime("%B %Y"),
        pdf_bytes,
        to_email=payload.to_email,
    )


@router.get("/{student_id}/id-card")
def get_id_card(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _assert_can_view_documents(db, current_user, student_id)
    pdf_bytes = DocumentService(db).generate_id_card(current_user.tenant_id, student_id)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=id-card.pdf"},
    )


@router.get("/{student_id}/certificate")
def get_certificate(
    student_id: uuid.UUID,
    achievement_text: str = Query(default="in recognition of outstanding academic performance and dedication"),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _assert_can_view_documents(db, current_user, student_id)
    pdf_bytes = DocumentService(db).generate_certificate(current_user.tenant_id, student_id, achievement_text)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=certificate.pdf"},
    )
