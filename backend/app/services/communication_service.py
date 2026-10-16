import calendar
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, ForbiddenError, NotFoundError
from app.models.communication import (
    CommunicationLog,
    DiaryEntry,
    DirectMessage,
    MessageThread,
    Notice,
    SchoolEvent,
    ThreadParticipant,
    TodoItem,
)
from app.models.user import ParentProfile, RoleEnum, StudentProfile, User
from app.repositories.academic_repo import ClassGradeRepository, SectionRepository, SubjectRepository
from app.repositories.communication_repo import (
    CommunicationLogRepository,
    DiaryEntryRepository,
    DirectMessageRepository,
    MessageThreadRepository,
    NoticeRepository,
    SchoolEventRepository,
    ThreadParticipantRepository,
    TodoItemRepository,
)
from app.repositories.parent_repo import ParentProfileRepository, ParentStudentLinkRepository
from app.repositories.student_repo import StudentProfileRepository
from app.schemas.communication import (
    ContactOut,
    DiaryCreate,
    DiaryOut,
    DiaryUpdate,
    EventCreate,
    EventUpdate,
    MessageOut,
    NoticeCreate,
    NoticeUpdate,
    ParticipantOut,
    SmsSendRequest,
    SmsSendResult,
    ThreadCreate,
    ThreadDetailOut,
    ThreadOut,
    TodoCreate,
    TodoUpdate,
)
from app.services.email_service import EmailService
from app.services.sms_service import SmsService

STAFF_ROLES = (RoleEnum.ADMIN, RoleEnum.TEACHER)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CommunicationService:
    def __init__(self, db: Session):
        self.db = db
        self.notices = NoticeRepository(db)
        self.diary = DiaryEntryRepository(db)
        self.threads = MessageThreadRepository(db)
        self.participants = ThreadParticipantRepository(db)
        self.messages = DirectMessageRepository(db)
        self.events = SchoolEventRepository(db)
        self.todos = TodoItemRepository(db)
        self.comm_logs = CommunicationLogRepository(db)
        self.classes = ClassGradeRepository(db)
        self.sections = SectionRepository(db)
        self.subjects = SubjectRepository(db)
        self.students = StudentProfileRepository(db)
        self.parent_profiles = ParentProfileRepository(db)
        self.parent_links = ParentStudentLinkRepository(db)

    # ---------- shared helpers ----------

    def _users_by_id(self, tenant_id: uuid.UUID, ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
        if not ids:
            return {}
        stmt = select(User).where(User.tenant_id == tenant_id, User.id.in_(ids))
        return {u.id: u for u in self.db.execute(stmt).scalars().all()}

    def _student_profile_for(self, user: User) -> StudentProfile:
        profile = self.students.get_by_user_id(user.tenant_id, user.id)
        if profile is None:
            raise NotFoundError("Student profile not found")
        return profile

    def _children_of(self, user: User) -> list[StudentProfile]:
        parent = self.parent_profiles.get_by_user_id(user.tenant_id, user.id)
        if parent is None:
            return []
        children = []
        for sid in self.parent_links.list_student_ids(user.tenant_id, parent.id):
            child = self.students.get_by_id(user.tenant_id, sid)
            if child is not None:
                children.append(child)
        return children

    def _viewer_class_ids(self, user: User) -> set[str]:
        if user.role == RoleEnum.STUDENT:
            profile = self.students.get_by_user_id(user.tenant_id, user.id)
            return {str(profile.class_grade_id)} if profile and profile.class_grade_id else set()
        if user.role == RoleEnum.PARENT:
            return {str(c.class_grade_id) for c in self._children_of(user) if c.class_grade_id}
        return set()

    def _validate_class_ids(self, tenant_id: uuid.UUID, class_ids: list[uuid.UUID] | None) -> list[str] | None:
        if not class_ids:
            return None
        for cid in class_ids:
            if self.classes.get_by_id(tenant_id, cid) is None:
                raise NotFoundError("Class not found")
        return [str(c) for c in class_ids]

    # ---------- notices ----------

    def create_notice(self, user: User, payload: NoticeCreate) -> Notice:
        if payload.audience == "classes" and not payload.class_ids:
            raise DomainError("Select at least one class for a class-specific notice")
        if payload.expiry_date and payload.publish_date and payload.expiry_date < payload.publish_date:
            raise DomainError("Expiry date cannot be before publish date")
        notice = self.notices.create(
            Notice(
                tenant_id=user.tenant_id,
                title=payload.title,
                body=payload.body,
                audience=payload.audience,
                class_ids=self._validate_class_ids(user.tenant_id, payload.class_ids)
                if payload.audience == "classes"
                else None,
                publish_date=payload.publish_date or _today(),
                expiry_date=payload.expiry_date,
                attachment_url=payload.attachment_url,
                is_pinned=payload.is_pinned,
                created_by_user_id=user.id,
            )
        )
        self.db.commit()
        self.db.refresh(notice)
        return notice

    def update_notice(self, user: User, notice_id: uuid.UUID, payload: NoticeUpdate) -> Notice:
        notice = self.notices.get_by_id(user.tenant_id, notice_id)
        if notice is None:
            raise NotFoundError("Notice not found")
        data = payload.model_dump(exclude_unset=True)
        if "class_ids" in data:
            data["class_ids"] = self._validate_class_ids(user.tenant_id, payload.class_ids)
        for field, value in data.items():
            setattr(notice, field, value)
        if notice.audience == "classes" and not notice.class_ids:
            raise DomainError("Select at least one class for a class-specific notice")
        if notice.audience != "classes":
            notice.class_ids = None
        self.db.commit()
        self.db.refresh(notice)
        return notice

    def delete_notice(self, user: User, notice_id: uuid.UUID) -> None:
        if self.notices.get_by_id(user.tenant_id, notice_id) is None:
            raise NotFoundError("Notice not found")
        self.notices.delete(user.tenant_id, notice_id)
        self.db.commit()

    def list_notices(self, user: User, include_inactive: bool = False) -> list[Notice]:
        if user.role == RoleEnum.ADMIN:
            return self.notices.list_filtered(user.tenant_id, None, None if include_inactive else _today())
        if user.role == RoleEnum.TEACHER:
            return self.notices.list_filtered(user.tenant_id, ["all", "staff", "classes"], _today())
        audience = "students" if user.role == RoleEnum.STUDENT else "parents"
        rows = self.notices.list_filtered(user.tenant_id, ["all", audience, "classes"], _today())
        my_classes = self._viewer_class_ids(user)
        return [n for n in rows if n.audience != "classes" or my_classes.intersection(n.class_ids or [])]

    # ---------- diary ----------

    def _diary_out(self, tenant_id: uuid.UUID, entries: list[DiaryEntry]) -> list[DiaryOut]:
        users = self._users_by_id(tenant_id, {e.posted_by_user_id for e in entries})
        cache: dict[tuple[str, uuid.UUID], str | None] = {}

        def name_of(kind: str, id_: uuid.UUID | None) -> str | None:
            if id_ is None:
                return None
            key = (kind, id_)
            if key not in cache:
                repo = {"class": self.classes, "section": self.sections, "subject": self.subjects}[kind]
                obj = repo.get_by_id(tenant_id, id_)
                cache[key] = obj.name if obj else None
            return cache[key]

        return [
            DiaryOut(
                id=e.id,
                class_grade_id=e.class_grade_id,
                class_name=name_of("class", e.class_grade_id),
                section_id=e.section_id,
                section_name=name_of("section", e.section_id),
                subject_id=e.subject_id,
                subject_name=name_of("subject", e.subject_id),
                diary_date=e.diary_date,
                homework=e.homework,
                attachment_url=e.attachment_url,
                posted_by_user_id=e.posted_by_user_id,
                posted_by_name=users[e.posted_by_user_id].full_name if e.posted_by_user_id in users else None,
            )
            for e in entries
        ]

    def _validate_diary_targets(
        self, tenant_id: uuid.UUID, class_grade_id: uuid.UUID, section_id: uuid.UUID | None, subject_id: uuid.UUID | None
    ) -> None:
        if self.classes.get_by_id(tenant_id, class_grade_id) is None:
            raise NotFoundError("Class not found")
        if section_id is not None:
            section = self.sections.get_by_id(tenant_id, section_id)
            if section is None or section.class_grade_id != class_grade_id:
                raise DomainError("Section does not belong to the selected class")
        if subject_id is not None:
            subject = self.subjects.get_by_id(tenant_id, subject_id)
            if subject is None or subject.class_grade_id != class_grade_id:
                raise DomainError("Subject does not belong to the selected class")

    def create_diary(self, user: User, payload: DiaryCreate) -> DiaryOut:
        self._validate_diary_targets(user.tenant_id, payload.class_grade_id, payload.section_id, payload.subject_id)
        entry = self.diary.create(
            DiaryEntry(
                tenant_id=user.tenant_id,
                class_grade_id=payload.class_grade_id,
                section_id=payload.section_id,
                subject_id=payload.subject_id,
                diary_date=payload.diary_date or _today(),
                homework=payload.homework,
                attachment_url=payload.attachment_url,
                posted_by_user_id=user.id,
            )
        )
        self.db.commit()
        self.db.refresh(entry)
        return self._diary_out(user.tenant_id, [entry])[0]

    def _owned_diary(self, user: User, entry_id: uuid.UUID) -> DiaryEntry:
        entry = self.diary.get_by_id(user.tenant_id, entry_id)
        if entry is None:
            raise NotFoundError("Diary entry not found")
        if user.role != RoleEnum.ADMIN and entry.posted_by_user_id != user.id:
            raise ForbiddenError("You can only change diary entries you posted")
        return entry

    def update_diary(self, user: User, entry_id: uuid.UUID, payload: DiaryUpdate) -> DiaryOut:
        entry = self._owned_diary(user, entry_id)
        data = payload.model_dump(exclude_unset=True)
        self._validate_diary_targets(
            user.tenant_id,
            entry.class_grade_id,
            data.get("section_id", entry.section_id),
            data.get("subject_id", entry.subject_id),
        )
        for field, value in data.items():
            setattr(entry, field, value)
        self.db.commit()
        self.db.refresh(entry)
        return self._diary_out(user.tenant_id, [entry])[0]

    def delete_diary(self, user: User, entry_id: uuid.UUID) -> None:
        self._owned_diary(user, entry_id)
        self.diary.delete(user.tenant_id, entry_id)
        self.db.commit()

    def list_diary(
        self,
        user: User,
        class_grade_id: uuid.UUID | None = None,
        section_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        student_id: uuid.UUID | None = None,
        mine: bool = False,
    ) -> list[DiaryOut]:
        tid = user.tenant_id
        if user.role in STAFF_ROLES:
            entries = self.diary.search(
                tid,
                class_grade_id=class_grade_id,
                section_id=section_id,
                subject_id=subject_id,
                date_from=date_from,
                date_to=date_to,
                posted_by_user_id=user.id if mine else None,
            )
            return self._diary_out(tid, entries)

        if user.role == RoleEnum.STUDENT:
            targets = [self._student_profile_for(user)]
        else:
            children = self._children_of(user)
            if student_id is not None:
                children = [c for c in children if c.id == student_id]
                if not children:
                    raise NotFoundError("Student not found")
            targets = children

        seen: dict[uuid.UUID, DiaryEntry] = {}
        for profile in targets:
            if profile.class_grade_id is None:
                continue
            for e in self.diary.search(
                tid,
                class_grade_id=profile.class_grade_id,
                section_id=profile.section_id,
                include_class_wide=True,
                subject_id=subject_id,
                date_from=date_from,
                date_to=date_to,
            ):
                if profile.section_id is None and e.section_id is not None:
                    continue  # student without a section only sees class-wide entries
                seen[e.id] = e
        entries = sorted(seen.values(), key=lambda e: (e.diary_date, e.created_at), reverse=True)
        return self._diary_out(tid, entries)

    # ---------- messages ----------

    def list_contacts(self, user: User, role: str | None = None, query: str | None = None) -> list[ContactOut]:
        stmt = select(User).where(User.tenant_id == user.tenant_id, User.is_active.is_(True), User.id != user.id)
        if user.role not in STAFF_ROLES:
            stmt = stmt.where(User.role.in_(STAFF_ROLES))
        if role:
            try:
                stmt = stmt.where(User.role == RoleEnum(role))
            except ValueError as exc:
                raise DomainError("Unknown role") from exc
        if query:
            stmt = stmt.where(User.full_name.ilike(f"%{query}%"))
        stmt = stmt.order_by(User.full_name).limit(200)
        return [
            ContactOut(user_id=u.id, full_name=u.full_name, role=u.role.value, email=u.email)
            for u in self.db.execute(stmt).scalars().all()
        ]

    def _thread_out(self, user: User, thread: MessageThread) -> ThreadOut:
        parts = self.participants.list_for_thread(user.tenant_id, thread.id)
        users = self._users_by_id(user.tenant_id, {p.user_id for p in parts})
        last = self.messages.last_for_thread(user.tenant_id, thread.id)
        return ThreadOut(
            id=thread.id,
            subject=thread.subject,
            created_by_user_id=thread.created_by_user_id,
            last_message_at=thread.last_message_at,
            last_message_preview=(last.body[:120] if last else None),
            unread_count=self.messages.unread_count(user.tenant_id, user.id, thread.id),
            participants=[
                ParticipantOut(user_id=uid, full_name=u.full_name, role=u.role.value)
                for uid, u in users.items()
            ],
        )

    def _participant_thread(self, user: User, thread_id: uuid.UUID) -> tuple[MessageThread, ThreadParticipant]:
        thread = self.threads.get_by_id(user.tenant_id, thread_id)
        participant = self.participants.get_for_user(user.tenant_id, thread_id, user.id) if thread else None
        if thread is None or participant is None:
            raise NotFoundError("Conversation not found")
        return thread, participant

    def create_thread(self, user: User, payload: ThreadCreate) -> ThreadDetailOut:
        ids = {pid for pid in payload.participant_user_ids if pid != user.id}
        if not ids:
            raise DomainError("Choose at least one recipient")
        recipients = self._users_by_id(user.tenant_id, ids)
        if len(recipients) != len(ids) or any(not u.is_active for u in recipients.values()):
            raise NotFoundError("Recipient not found")
        if user.role not in STAFF_ROLES and any(u.role not in STAFF_ROLES for u in recipients.values()):
            raise ForbiddenError("Students and parents can only message school staff")
        now = _now()
        thread = self.threads.create(
            MessageThread(tenant_id=user.tenant_id, subject=payload.subject, created_by_user_id=user.id, last_message_at=now)
        )
        self.participants.create(
            ThreadParticipant(tenant_id=user.tenant_id, thread_id=thread.id, user_id=user.id, last_read_at=now)
        )
        for uid in ids:
            self.participants.create(ThreadParticipant(tenant_id=user.tenant_id, thread_id=thread.id, user_id=uid))
        self.messages.create(
            DirectMessage(tenant_id=user.tenant_id, thread_id=thread.id, sender_user_id=user.id, body=payload.body)
        )
        self.db.commit()
        return self.get_thread(user, thread.id)

    def list_threads(self, user: User) -> list[ThreadOut]:
        return [self._thread_out(user, t) for t in self.threads.list_for_user(user.tenant_id, user.id)]

    def get_thread(self, user: User, thread_id: uuid.UUID) -> ThreadDetailOut:
        thread, participant = self._participant_thread(user, thread_id)
        msgs = self.messages.list_for_thread(user.tenant_id, thread.id)
        participant.last_read_at = _now()
        self.db.commit()
        self.db.refresh(thread)
        base = self._thread_out(user, thread)
        senders = self._users_by_id(user.tenant_id, {m.sender_user_id for m in msgs})
        return ThreadDetailOut(
            **base.model_dump(),
            messages=[
                MessageOut(
                    id=m.id,
                    thread_id=m.thread_id,
                    sender_user_id=m.sender_user_id,
                    sender_name=senders[m.sender_user_id].full_name if m.sender_user_id in senders else "—",
                    body=m.body,
                    created_at=m.created_at,
                    is_mine=m.sender_user_id == user.id,
                )
                for m in msgs
            ],
        )

    def post_message(self, user: User, thread_id: uuid.UUID, body: str) -> ThreadDetailOut:
        thread, participant = self._participant_thread(user, thread_id)
        msg = self.messages.create(
            DirectMessage(tenant_id=user.tenant_id, thread_id=thread.id, sender_user_id=user.id, body=body)
        )
        thread.last_message_at = msg.created_at or _now()
        self.db.commit()
        return self.get_thread(user, thread.id)

    def unread_count(self, user: User) -> int:
        return self.messages.unread_count(user.tenant_id, user.id)

    # ---------- events ----------

    def _event_audiences(self, user: User) -> list[str] | None:
        return {
            RoleEnum.ADMIN: None,
            RoleEnum.TEACHER: ["all", "staff"],
            RoleEnum.STUDENT: ["all", "students"],
            RoleEnum.PARENT: ["all", "parents"],
        }[user.role]

    def list_events(
        self,
        user: User,
        year: int | None = None,
        month: int | None = None,
        start: date | None = None,
        end: date | None = None,
    ) -> list[SchoolEvent]:
        if year and month:
            start = date(year, month, 1)
            end = date(year, month, calendar.monthrange(year, month)[1])
        elif year:
            start, end = date(year, 1, 1), date(year, 12, 31)
        return self.events.list_in_range(user.tenant_id, start, end, self._event_audiences(user))

    def create_event(self, user: User, payload: EventCreate) -> SchoolEvent:
        end_date = payload.end_date or payload.start_date
        if end_date < payload.start_date:
            raise DomainError("End date cannot be before start date")
        event = self.events.create(
            SchoolEvent(
                tenant_id=user.tenant_id,
                title=payload.title,
                description=payload.description,
                start_date=payload.start_date,
                end_date=end_date,
                event_type=payload.event_type,
                audience=payload.audience,
                created_by_user_id=user.id,
            )
        )
        self.db.commit()
        self.db.refresh(event)
        return event

    def update_event(self, user: User, event_id: uuid.UUID, payload: EventUpdate) -> SchoolEvent:
        event = self.events.get_by_id(user.tenant_id, event_id)
        if event is None:
            raise NotFoundError("Event not found")
        for field, value in payload.model_dump(exclude_unset=True).items():
            if value is not None or field == "description":
                setattr(event, field, value)
        if event.end_date < event.start_date:
            raise DomainError("End date cannot be before start date")
        self.db.commit()
        self.db.refresh(event)
        return event

    def delete_event(self, user: User, event_id: uuid.UUID) -> None:
        if self.events.get_by_id(user.tenant_id, event_id) is None:
            raise NotFoundError("Event not found")
        self.events.delete(user.tenant_id, event_id)
        self.db.commit()

    # ---------- to-do ----------

    def _own_todo(self, user: User, todo_id: uuid.UUID) -> TodoItem:
        todo = self.todos.get_by_id(user.tenant_id, todo_id)
        if todo is None or todo.user_id != user.id:
            raise NotFoundError("To-do item not found")
        return todo

    def list_todos(self, user: User, include_done: bool = True) -> list[TodoItem]:
        return self.todos.list_for_user(user.tenant_id, user.id, include_done)

    def create_todo(self, user: User, payload: TodoCreate) -> TodoItem:
        todo = self.todos.create(
            TodoItem(tenant_id=user.tenant_id, user_id=user.id, title=payload.title, due_date=payload.due_date)
        )
        self.db.commit()
        self.db.refresh(todo)
        return todo

    def update_todo(self, user: User, todo_id: uuid.UUID, payload: TodoUpdate) -> TodoItem:
        todo = self._own_todo(user, todo_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            if field == "is_done" and value is None:
                continue
            setattr(todo, field, value)
        self.db.commit()
        self.db.refresh(todo)
        return todo

    def delete_todo(self, user: User, todo_id: uuid.UUID) -> None:
        self._own_todo(user, todo_id)
        self.todos.delete(user.tenant_id, todo_id)
        self.db.commit()

    # ---------- SMS ----------

    def _parent_recipients(self, tenant_id: uuid.UUID, payload: SmsSendRequest) -> list[tuple[User, ParentProfile]]:
        if payload.audience == "class_parents":
            if payload.class_grade_id is None:
                raise DomainError("Select a class")
            if self.classes.get_by_id(tenant_id, payload.class_grade_id) is None:
                raise NotFoundError("Class not found")
            students = self.students.list_with_users(
                tenant_id, class_grade_id=payload.class_grade_id, section_id=payload.section_id, status="active"
            )
        else:
            students = self.students.list_with_users(tenant_id, status="active")
        recipients: dict[uuid.UUID, tuple[User, ParentProfile]] = {}
        for profile, _ in students:
            for parent_id in self.parent_links.list_parent_ids_for_student(tenant_id, profile.id):
                if parent_id in recipients:
                    continue
                parent = self.parent_profiles.get_by_id(tenant_id, parent_id)
                if parent is None:
                    continue
                parent_user = self.db.get(User, parent.user_id)
                if parent_user is not None and parent_user.is_active and parent_user.tenant_id == tenant_id:
                    recipients[parent_id] = (parent_user, parent)
        return list(recipients.values())

    def send_sms(self, user: User, payload: SmsSendRequest) -> SmsSendResult:
        tid = user.tenant_id
        audience_label = "All parents"
        if payload.audience == "class_parents" and payload.class_grade_id:
            grade = self.classes.get_by_id(tid, payload.class_grade_id)
            audience_label = f"Parents of {grade.name if grade else 'class'}"
            if payload.section_id:
                section = self.sections.get_by_id(tid, payload.section_id)
                if section is None or section.class_grade_id != payload.class_grade_id:
                    raise DomainError("Section does not belong to the selected class")
                audience_label += f" - {section.name}"
        recipients = self._parent_recipients(tid, payload)
        sms, email = SmsService(), EmailService()
        counts = {"sms_sent": 0, "sms_skipped": 0, "sms_failed": 0, "email_sent": 0, "email_skipped": 0}

        def log(channel: str, recipient: User, address: str | None, status: str, detail: str | None) -> None:
            self.comm_logs.create(
                CommunicationLog(
                    tenant_id=tid,
                    channel=channel,
                    audience=audience_label,
                    recipient_user_id=recipient.id,
                    recipient_name=recipient.full_name,
                    recipient_address=address,
                    message=payload.message,
                    status=status,
                    detail=detail,
                    sent_by_user_id=user.id,
                )
            )

        for parent_user, parent_profile in recipients:
            if not parent_profile.sms_opt_in:
                status, detail = "skipped", "Parent opted out of SMS"
            elif not parent_user.phone_number:
                status, detail = "skipped", "No phone number on file"
            else:
                result = sms.send(parent_user.phone_number, payload.message)
                status, detail = result.status, result.detail
            log("sms", parent_user, parent_user.phone_number, status, detail)
            counts[f"sms_{status}"] += 1

            if status != "sent" and payload.email_fallback and parent_user.email:
                if email.is_configured() and email.send(parent_user.email, "Message from school", payload.message):
                    log("email", parent_user, parent_user.email, "sent", "SMS fallback")
                    counts["email_sent"] += 1
                else:
                    log("email", parent_user, parent_user.email, "skipped", "Email not configured or failed")
                    counts["email_skipped"] += 1
        self.db.commit()
        return SmsSendResult(recipients=len(recipients), **counts)

    def list_comm_logs(self, user: User) -> list[CommunicationLog]:
        return self.comm_logs.recent(user.tenant_id)
