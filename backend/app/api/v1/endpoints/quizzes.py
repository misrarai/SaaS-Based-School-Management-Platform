import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.quiz import (
    AttemptOut,
    AttemptReviewOut,
    GradeAttemptRequest,
    MyAttemptHistoryEntry,
    QuizCreate,
    QuizOut,
    QuizTakeOut,
    QuizUpdate,
    ResultEntry,
    SubmitAttemptRequest,
)
from app.services.parent_service import ParentService
from app.services.quiz_service import QuizService

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.post("", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_quiz(
    payload: QuizCreate,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> QuizOut:
    return QuizService(db).create_quiz(current_user.tenant_id, current_user.id, payload)


@router.get("", response_model=list[QuizOut])
def list_quizzes(
    section_id: uuid.UUID | None = Query(default=None),
    subject_id: uuid.UUID | None = Query(default=None),
    chapter_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[QuizOut]:
    tenant_id = current_user.tenant_id
    service = QuizService(db)

    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            return []
        return service.list_quizzes(
            tenant_id, section_id=section_id, subject_id=subject_id, teacher_id=profile.id, chapter_id=chapter_id
        )

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None or profile.section_id is None:
            return []
        return service.list_quizzes(
            tenant_id, section_id=profile.section_id, subject_id=subject_id, published_only=True, chapter_id=chapter_id
        )

    if current_user.role == RoleEnum.PARENT:
        children = ParentService(db).list_children_profiles(tenant_id, current_user.id)
        section_ids = {c.section_id for c in children if c.section_id is not None}
        results: list[QuizOut] = []
        for sid in section_ids:
            results.extend(
                service.list_quizzes(tenant_id, section_id=sid, subject_id=subject_id, published_only=True, chapter_id=chapter_id)
            )
        return results

    return service.list_quizzes(tenant_id, section_id=section_id, subject_id=subject_id, chapter_id=chapter_id)


@router.patch("/{quiz_id}", response_model=QuizOut)
def update_quiz(
    quiz_id: uuid.UUID,
    payload: QuizUpdate,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> QuizOut:
    return QuizService(db).update_quiz(current_user.tenant_id, quiz_id, current_user.id, payload)


@router.get("/{quiz_id}/take", response_model=QuizTakeOut)
def get_quiz_for_taking(
    quiz_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> QuizTakeOut:
    return QuizService(db).get_quiz_for_taking(current_user.tenant_id, quiz_id, current_user.id)


@router.get("/attempts/me", response_model=list[MyAttemptHistoryEntry])
def list_my_attempts(
    current_user: User = Depends(require_role(RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> list[MyAttemptHistoryEntry]:
    return QuizService(db).list_my_attempts(current_user.tenant_id, current_user.id)


@router.post("/{quiz_id}/attempts/start", response_model=AttemptOut, status_code=status.HTTP_201_CREATED)
def start_attempt(
    quiz_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> AttemptOut:
    return QuizService(db).start_attempt(current_user.tenant_id, quiz_id, current_user.id)


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptOut)
def submit_attempt(
    attempt_id: uuid.UUID,
    payload: SubmitAttemptRequest,
    current_user: User = Depends(require_role(RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> AttemptOut:
    return QuizService(db).submit_attempt(current_user.tenant_id, attempt_id, current_user.id, payload)


@router.get("/attempts/{attempt_id}/review", response_model=AttemptReviewOut)
def get_attempt_review_for_teacher(
    attempt_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> AttemptReviewOut:
    return QuizService(db).get_attempt_review_for_teacher(current_user.tenant_id, attempt_id, current_user.id)


@router.post("/attempts/{attempt_id}/grade", response_model=AttemptOut)
def grade_attempt(
    attempt_id: uuid.UUID,
    payload: GradeAttemptRequest,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> AttemptOut:
    return QuizService(db).grade_attempt(current_user.tenant_id, attempt_id, current_user.id, payload)


@router.get("/{quiz_id}/my-attempt", response_model=AttemptReviewOut)
def get_my_attempt(
    quiz_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.STUDENT)),
    db: Session = Depends(get_db),
) -> AttemptReviewOut:
    return QuizService(db).get_my_attempt_review(current_user.tenant_id, quiz_id, current_user.id)


@router.get("/{quiz_id}/results", response_model=list[ResultEntry])
def get_results(
    quiz_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.TEACHER, RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[ResultEntry]:
    service = QuizService(db)
    if current_user.role == RoleEnum.ADMIN:
        return service.get_results_any(current_user.tenant_id, quiz_id)
    return service.get_results(current_user.tenant_id, quiz_id, current_user.id)
