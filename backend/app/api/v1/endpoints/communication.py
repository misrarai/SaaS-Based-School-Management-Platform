import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.communication import (
    CommunicationLogOut,
    ContactOut,
    DiaryCreate,
    DiaryOut,
    DiaryUpdate,
    EventCreate,
    EventOut,
    EventUpdate,
    MessageCreate,
    NoticeCreate,
    NoticeOut,
    NoticeUpdate,
    SmsSendRequest,
    SmsSendResult,
    ThreadCreate,
    ThreadDetailOut,
    ThreadOut,
    TodoCreate,
    TodoOut,
    TodoUpdate,
    UnreadCountOut,
)
from app.services.communication_service import CommunicationService

router = APIRouter(prefix="/communication", tags=["communication"])

admin_only = require_role(RoleEnum.ADMIN)
staff_only = require_role(RoleEnum.ADMIN, RoleEnum.TEACHER)
any_role = require_role(RoleEnum.ADMIN, RoleEnum.TEACHER, RoleEnum.STUDENT, RoleEnum.PARENT)


# ---------- Notices ----------


@router.get("/notices", response_model=list[NoticeOut])
def list_notices(
    include_inactive: bool = False, current_user: User = Depends(any_role), db: Session = Depends(get_db)
):
    return CommunicationService(db).list_notices(current_user, include_inactive)


@router.post("/notices", response_model=NoticeOut, status_code=status.HTTP_201_CREATED)
def create_notice(payload: NoticeCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return CommunicationService(db).create_notice(current_user, payload)


@router.patch("/notices/{notice_id}", response_model=NoticeOut)
def update_notice(
    notice_id: uuid.UUID, payload: NoticeUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return CommunicationService(db).update_notice(current_user, notice_id, payload)


@router.delete("/notices/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notice(notice_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    CommunicationService(db).delete_notice(current_user, notice_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Diary ----------


@router.get("/diary", response_model=list[DiaryOut])
def list_diary(
    class_grade_id: uuid.UUID | None = None,
    section_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    on_date: date | None = Query(default=None, alias="date"),
    student_id: uuid.UUID | None = None,
    mine: bool = False,
    current_user: User = Depends(any_role),
    db: Session = Depends(get_db),
):
    if on_date is not None:
        date_from = date_to = on_date
    return CommunicationService(db).list_diary(
        current_user,
        class_grade_id=class_grade_id,
        section_id=section_id,
        subject_id=subject_id,
        date_from=date_from,
        date_to=date_to,
        student_id=student_id,
        mine=mine,
    )


@router.post("/diary", response_model=DiaryOut, status_code=status.HTTP_201_CREATED)
def create_diary(payload: DiaryCreate, current_user: User = Depends(staff_only), db: Session = Depends(get_db)):
    return CommunicationService(db).create_diary(current_user, payload)


@router.patch("/diary/{entry_id}", response_model=DiaryOut)
def update_diary(
    entry_id: uuid.UUID, payload: DiaryUpdate, current_user: User = Depends(staff_only), db: Session = Depends(get_db)
):
    return CommunicationService(db).update_diary(current_user, entry_id, payload)


@router.delete("/diary/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diary(entry_id: uuid.UUID, current_user: User = Depends(staff_only), db: Session = Depends(get_db)):
    CommunicationService(db).delete_diary(current_user, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Messages ----------


@router.get("/messages/contacts", response_model=list[ContactOut])
def list_contacts(
    role: str | None = None,
    q: str | None = None,
    current_user: User = Depends(any_role),
    db: Session = Depends(get_db),
):
    return CommunicationService(db).list_contacts(current_user, role, q)


@router.get("/messages/unread-count", response_model=UnreadCountOut)
def unread_count(current_user: User = Depends(any_role), db: Session = Depends(get_db)):
    return UnreadCountOut(unread=CommunicationService(db).unread_count(current_user))


@router.get("/messages/threads", response_model=list[ThreadOut])
def list_threads(current_user: User = Depends(any_role), db: Session = Depends(get_db)):
    return CommunicationService(db).list_threads(current_user)


@router.post("/messages/threads", response_model=ThreadDetailOut, status_code=status.HTTP_201_CREATED)
def create_thread(payload: ThreadCreate, current_user: User = Depends(any_role), db: Session = Depends(get_db)):
    return CommunicationService(db).create_thread(current_user, payload)


@router.get("/messages/threads/{thread_id}", response_model=ThreadDetailOut)
def get_thread(thread_id: uuid.UUID, current_user: User = Depends(any_role), db: Session = Depends(get_db)):
    return CommunicationService(db).get_thread(current_user, thread_id)


@router.post("/messages/threads/{thread_id}/messages", response_model=ThreadDetailOut, status_code=status.HTTP_201_CREATED)
def post_message(
    thread_id: uuid.UUID, payload: MessageCreate, current_user: User = Depends(any_role), db: Session = Depends(get_db)
):
    return CommunicationService(db).post_message(current_user, thread_id, payload.body)


# ---------- Events calendar ----------


@router.get("/events", response_model=list[EventOut])
def list_events(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    start: date | None = None,
    end: date | None = None,
    current_user: User = Depends(any_role),
    db: Session = Depends(get_db),
):
    return CommunicationService(db).list_events(current_user, year, month, start, end)


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return CommunicationService(db).create_event(current_user, payload)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: uuid.UUID, payload: EventUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    return CommunicationService(db).update_event(current_user, event_id, payload)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: uuid.UUID, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    CommunicationService(db).delete_event(current_user, event_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- To-do ----------


@router.get("/todos", response_model=list[TodoOut])
def list_todos(include_done: bool = True, current_user: User = Depends(any_role), db: Session = Depends(get_db)):
    return CommunicationService(db).list_todos(current_user, include_done)


@router.post("/todos", response_model=TodoOut, status_code=status.HTTP_201_CREATED)
def create_todo(payload: TodoCreate, current_user: User = Depends(any_role), db: Session = Depends(get_db)):
    return CommunicationService(db).create_todo(current_user, payload)


@router.patch("/todos/{todo_id}", response_model=TodoOut)
def update_todo(
    todo_id: uuid.UUID, payload: TodoUpdate, current_user: User = Depends(any_role), db: Session = Depends(get_db)
):
    return CommunicationService(db).update_todo(current_user, todo_id, payload)


@router.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(todo_id: uuid.UUID, current_user: User = Depends(any_role), db: Session = Depends(get_db)):
    CommunicationService(db).delete_todo(current_user, todo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- SMS ----------


@router.post("/sms/send", response_model=SmsSendResult)
def send_sms(payload: SmsSendRequest, current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return CommunicationService(db).send_sms(current_user, payload)


@router.get("/sms/logs", response_model=list[CommunicationLogOut])
def list_sms_logs(current_user: User = Depends(admin_only), db: Session = Depends(get_db)):
    return CommunicationService(db).list_comm_logs(current_user)
