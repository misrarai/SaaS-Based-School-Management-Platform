import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import DomainError
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentOut,
    GradebookEntry,
    GradeSubmissionRequest,
    SubjectPerformanceEntry,
    SubmissionCreate,
    SubmissionOut,
)
from app.services.assignment_service import AssignmentService
from app.services.parent_service import ParentService

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.post("", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: AssignmentCreate,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> AssignmentOut:
    return AssignmentService(db).create_assignment(current_user.tenant_id, current_user.id, payload)


@router.get("", response_model=list[AssignmentOut])
def list_assignments(
    section_id: uuid.UUID | None = Query(default=None),
    subject_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[AssignmentOut]:
    tenant_id = current_user.tenant_id
    service = AssignmentService(db)

    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return service.list_assignments(tenant_id, section_id=section_id, subject_id=subject_id, teacher_id=profile.id)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None or profile.section_id is None:
            return []
        return service.list_assignments(tenant_id, section_id=profile.section_id, subject_id=subject_id)

    if current_user.role == RoleEnum.PARENT:
        children = ParentService(db).list_children_profiles(tenant_id, current_user.id)
        section_ids = {c.section_id for c in children if c.section_id is not None}
        results = []
        for sid in section_ids:
            results.extend(service.list_assignments(tenant_id, section_id=sid, subject_id=subject_id))
        return results

    return service.list_assignments(tenant_id, section_id=section_id, subject_id=subject_id)


@router.get("/gradebook", response_model=list[GradebookEntry])
def get_gradebook(
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[GradebookEntry]:
    tenant_id = current_user.tenant_id
    service = AssignmentService(db)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return service.get_gradebook(tenant_id, profile.id)

    if student_id is None:
        raise DomainError("student_id is required")

    if current_user.role == RoleEnum.PARENT:
        ParentService(db).assert_child(tenant_id, current_user.id, student_id)

    return service.get_gradebook(tenant_id, student_id)


@router.get("/performance", response_model=list[SubjectPerformanceEntry])
def get_subject_performance(
    student_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[SubjectPerformanceEntry]:
    tenant_id = current_user.tenant_id
    service = AssignmentService(db)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return service.get_subject_performance(tenant_id, profile.id)

    if student_id is None:
        raise DomainError("student_id is required")

    if current_user.role == RoleEnum.PARENT:
        ParentService(db).assert_child(tenant_id, current_user.id, student_id)

    return service.get_subject_performance(tenant_id, student_id)


@router.get("/{assignment_id}/submissions", response_model=list[SubmissionOut])
def list_submissions(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.TEACHER, RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[SubmissionOut]:
    service = AssignmentService(db)
    if current_user.role == RoleEnum.ADMIN:
        return service.list_submissions_any(current_user.tenant_id, assignment_id)
    return service.list_submissions(current_user.tenant_id, assignment_id, current_user.id)


@router.post("/{assignment_id}/submit", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def submit_assignment(
    assignment_id: uuid.UUID,
    payload: SubmissionCreate,
    current_user: User = Depends(require_role(RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> SubmissionOut:
    return AssignmentService(db).submit_assignment(current_user.tenant_id, assignment_id, current_user.id, payload.file_url)


@router.post("/submissions/{submission_id}/grade", response_model=SubmissionOut)
def grade_submission(
    submission_id: uuid.UUID,
    payload: GradeSubmissionRequest,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> SubmissionOut:
    return AssignmentService(db).grade_submission(current_user.tenant_id, submission_id, current_user.id, payload)
