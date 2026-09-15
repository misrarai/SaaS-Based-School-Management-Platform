import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.core.exceptions import ForbiddenError
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.repositories.user_repo import UserRepository
from app.schemas.schedule import (
    ClassScheduleCreate,
    ClassScheduleOut,
    ClassScheduleUpdate,
    ClassSessionOut,
    ClassSessionUpdate,
    GenerateSessionsRequest,
    MeetingTokenOut,
    OnlineClassCreate,
)
from app.services.jitsi_service import JitsiService
from app.services.parent_service import ParentService
from app.services.schedule_service import ScheduleService

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.post("/templates", response_model=ClassScheduleOut, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: ClassScheduleCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> ClassScheduleOut:
    return ScheduleService(db).create_schedule(current_user.tenant_id, payload)


@router.get("/templates", response_model=list[ClassScheduleOut])
def list_templates(
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[ClassScheduleOut]:
    return ScheduleService(db).list_schedules(current_user.tenant_id)


@router.patch("/templates/{schedule_id}", response_model=ClassScheduleOut)
def update_template(
    schedule_id: uuid.UUID,
    payload: ClassScheduleUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> ClassScheduleOut:
    return ScheduleService(db).update_schedule(current_user.tenant_id, schedule_id, payload)


@router.post("/sessions/generate", response_model=list[ClassSessionOut], status_code=status.HTTP_201_CREATED)
def generate_sessions(
    payload: GenerateSessionsRequest,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> list[ClassSessionOut]:
    return ScheduleService(db).generate_sessions(current_user.tenant_id, payload.start_date, payload.end_date)


@router.post("/sessions", response_model=ClassSessionOut, status_code=status.HTTP_201_CREATED)
def create_online_class(
    payload: OnlineClassCreate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> ClassSessionOut:
    """Creates one dated online class and generates its Google Meet link. A teacher may only
    create a class where they are themselves the teacher — enforced here, not just hidden in the
    UI, same as every other role check in this router."""
    service = ScheduleService(db)
    if current_user.role == RoleEnum.TEACHER:
        teacher_profile_id = service._teacher_profile_id_for_user(current_user.tenant_id, current_user.id)
        if payload.teacher_id != teacher_profile_id:
            raise ForbiddenError("You can only create online classes for yourself")
    return service.create_online_class(current_user.tenant_id, payload)


@router.post("/sessions/{session_id}/generate-meet", response_model=ClassSessionOut)
def generate_meet(
    session_id: uuid.UUID,
    force: bool = Query(default=False, description="Regenerate even if a Meet link already exists"),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> ClassSessionOut:
    """Idempotent: calling this again on a session that already has a Meet link is a no-op
    unless force=true, so retried requests never create duplicate Google Calendar events."""
    service = ScheduleService(db)
    session = service.get_session_or_404(current_user.tenant_id, session_id)
    if current_user.role == RoleEnum.TEACHER:
        teacher_profile_id = service._teacher_profile_id_for_user(current_user.tenant_id, current_user.id)
        if session.teacher_id != teacher_profile_id:
            raise ForbiddenError("You do not teach this session")
    return service.generate_meet_link(current_user.tenant_id, session_id, force=force)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> None:
    ScheduleService(db).delete_session(current_user.tenant_id, session_id)


@router.get("/sessions", response_model=list[ClassSessionOut])
def list_sessions(
    teacher_id: uuid.UUID | None = Query(default=None),
    section_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)),
    db: Session = Depends(get_db),
) -> list[ClassSessionOut]:
    tenant_id = current_user.tenant_id
    service = ScheduleService(db)

    if current_user.role == RoleEnum.TEACHER:
        profile = TeacherProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None:
            raise ForbiddenError("Teacher profile not found")
        return service.list_sessions_for_role(tenant_id, teacher_id=profile.id, date_from=date_from, date_to=date_to)

    if current_user.role == RoleEnum.STUDENT:
        profile = StudentProfileRepository(db).get_by_user_id(tenant_id, current_user.id)
        if profile is None or profile.section_id is None:
            return []
        return service.list_sessions_for_role(
            tenant_id, section_id=profile.section_id, date_from=date_from, date_to=date_to
        )

    if current_user.role == RoleEnum.PARENT:
        children = ParentService(db).list_children_profiles(tenant_id, current_user.id)
        section_ids = [c.section_id for c in children if c.section_id is not None]
        if not section_ids:
            return []
        return service.list_sessions_for_role(tenant_id, section_ids=section_ids, date_from=date_from, date_to=date_to)

    return service.list_sessions_for_role(
        tenant_id, teacher_id=teacher_id, section_id=section_id, date_from=date_from, date_to=date_to
    )


@router.patch("/sessions/{session_id}", response_model=ClassSessionOut)
def update_session(
    session_id: uuid.UUID,
    payload: ClassSessionUpdate,
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
    db: Session = Depends(get_db),
) -> ClassSessionOut:
    return ScheduleService(db).update_session(current_user.tenant_id, session_id, payload)


@router.post("/sessions/{session_id}/start", response_model=ClassSessionOut)
def start_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> ClassSessionOut:
    return ScheduleService(db).start_session(current_user.tenant_id, session_id, current_user.id)


@router.post("/sessions/{session_id}/end", response_model=ClassSessionOut)
def end_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_role(RoleEnum.TEACHER)),
    db: Session = Depends(get_db),
) -> ClassSessionOut:
    return ScheduleService(db).end_session(current_user.tenant_id, session_id, current_user.id)


@router.get("/sessions/{session_id}/meeting-token", response_model=MeetingTokenOut)
def get_meeting_token(
    session_id: uuid.UUID,
    current_user: User = Depends(
        require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)
    ),
    db: Session = Depends(get_db),
) -> MeetingTokenOut:
    """Generate a Jitsi Meet JWT for the given session.

    Teachers receive moderator rights; students and parents are regular
    participants.  When JITSI_APP_ID / JITSI_JWT_SECRET are not set the
    endpoint still returns a valid (unauthenticated) public-room URL so the
    academy can run classes on meet.jit.si from day one.
    """
    # Verify the session exists and belongs to this tenant.
    session = ScheduleService(db).get_session_or_404(current_user.tenant_id, session_id)

    # Resolve the caller's display name from their User record.
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(current_user.tenant_id, current_user.id)
    user_name = user.full_name if user else current_user.email
    user_email = current_user.email

    is_moderator = current_user.role in (RoleEnum.ADMIN, RoleEnum.TEACHER)

    result = JitsiService().generate_token(
        session_id=session.id,
        user_name=user_name,
        user_email=user_email,
        is_moderator=is_moderator,
    )

    return MeetingTokenOut(
        session_id=session.id,
        room_name=result["room_name"],
        meeting_url=result["meeting_url"],
        jwt_token=result["jwt_token"],
        authenticated=result["authenticated"],
    )
