import uuid
from datetime import date

from sqlalchemy import and_, func, or_, select

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
from app.repositories.base import BaseRepository


class NoticeRepository(BaseRepository[Notice]):
    model = Notice

    def list_filtered(
        self, tenant_id: uuid.UUID, audiences: list[str] | None = None, active_on: date | None = None
    ) -> list[Notice]:
        """audiences=None -> every notice (admin view). active_on -> published and not expired."""
        stmt = select(Notice).where(Notice.tenant_id == tenant_id)
        if audiences is not None:
            stmt = stmt.where(Notice.audience.in_(audiences))
        if active_on is not None:
            stmt = stmt.where(
                Notice.publish_date <= active_on,
                or_(Notice.expiry_date.is_(None), Notice.expiry_date >= active_on),
            )
        stmt = stmt.order_by(Notice.is_pinned.desc(), Notice.publish_date.desc(), Notice.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())


class DiaryEntryRepository(BaseRepository[DiaryEntry]):
    model = DiaryEntry

    def search(
        self,
        tenant_id: uuid.UUID,
        class_grade_id: uuid.UUID | None = None,
        section_id: uuid.UUID | None = None,
        include_class_wide: bool = False,
        subject_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        posted_by_user_id: uuid.UUID | None = None,
    ) -> list[DiaryEntry]:
        stmt = select(DiaryEntry).where(DiaryEntry.tenant_id == tenant_id)
        if class_grade_id:
            stmt = stmt.where(DiaryEntry.class_grade_id == class_grade_id)
        if section_id:
            if include_class_wide:
                stmt = stmt.where(or_(DiaryEntry.section_id == section_id, DiaryEntry.section_id.is_(None)))
            else:
                stmt = stmt.where(DiaryEntry.section_id == section_id)
        if subject_id:
            stmt = stmt.where(DiaryEntry.subject_id == subject_id)
        if date_from:
            stmt = stmt.where(DiaryEntry.diary_date >= date_from)
        if date_to:
            stmt = stmt.where(DiaryEntry.diary_date <= date_to)
        if posted_by_user_id:
            stmt = stmt.where(DiaryEntry.posted_by_user_id == posted_by_user_id)
        stmt = stmt.order_by(DiaryEntry.diary_date.desc(), DiaryEntry.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())


class MessageThreadRepository(BaseRepository[MessageThread]):
    model = MessageThread

    def list_for_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[MessageThread]:
        stmt = (
            select(MessageThread)
            .join(ThreadParticipant, ThreadParticipant.thread_id == MessageThread.id)
            .where(MessageThread.tenant_id == tenant_id, ThreadParticipant.user_id == user_id)
            .order_by(MessageThread.last_message_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())


class ThreadParticipantRepository(BaseRepository[ThreadParticipant]):
    model = ThreadParticipant

    def list_for_thread(self, tenant_id: uuid.UUID, thread_id: uuid.UUID) -> list[ThreadParticipant]:
        stmt = select(ThreadParticipant).where(
            ThreadParticipant.tenant_id == tenant_id, ThreadParticipant.thread_id == thread_id
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_for_user(self, tenant_id: uuid.UUID, thread_id: uuid.UUID, user_id: uuid.UUID) -> ThreadParticipant | None:
        stmt = select(ThreadParticipant).where(
            ThreadParticipant.tenant_id == tenant_id,
            ThreadParticipant.thread_id == thread_id,
            ThreadParticipant.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()


class DirectMessageRepository(BaseRepository[DirectMessage]):
    model = DirectMessage

    def list_for_thread(self, tenant_id: uuid.UUID, thread_id: uuid.UUID) -> list[DirectMessage]:
        stmt = (
            select(DirectMessage)
            .where(DirectMessage.tenant_id == tenant_id, DirectMessage.thread_id == thread_id)
            .order_by(DirectMessage.created_at)
        )
        return list(self.db.execute(stmt).scalars().all())

    def last_for_thread(self, tenant_id: uuid.UUID, thread_id: uuid.UUID) -> DirectMessage | None:
        stmt = (
            select(DirectMessage)
            .where(DirectMessage.tenant_id == tenant_id, DirectMessage.thread_id == thread_id)
            .order_by(DirectMessage.created_at.desc())
            .limit(1)
        )
        return self.db.execute(stmt).scalars().first()

    def unread_count(self, tenant_id: uuid.UUID, user_id: uuid.UUID, thread_id: uuid.UUID | None = None) -> int:
        stmt = (
            select(func.count(DirectMessage.id))
            .join(
                ThreadParticipant,
                and_(
                    ThreadParticipant.thread_id == DirectMessage.thread_id,
                    ThreadParticipant.user_id == user_id,
                ),
            )
            .where(
                DirectMessage.tenant_id == tenant_id,
                DirectMessage.sender_user_id != user_id,
                or_(ThreadParticipant.last_read_at.is_(None), DirectMessage.created_at > ThreadParticipant.last_read_at),
            )
        )
        if thread_id is not None:
            stmt = stmt.where(DirectMessage.thread_id == thread_id)
        return int(self.db.execute(stmt).scalar_one())


class SchoolEventRepository(BaseRepository[SchoolEvent]):
    model = SchoolEvent

    def list_in_range(
        self, tenant_id: uuid.UUID, start: date | None, end: date | None, audiences: list[str] | None = None
    ) -> list[SchoolEvent]:
        stmt = select(SchoolEvent).where(SchoolEvent.tenant_id == tenant_id)
        if start is not None:
            stmt = stmt.where(SchoolEvent.end_date >= start)
        if end is not None:
            stmt = stmt.where(SchoolEvent.start_date <= end)
        if audiences is not None:
            stmt = stmt.where(SchoolEvent.audience.in_(audiences))
        return list(self.db.execute(stmt.order_by(SchoolEvent.start_date)).scalars().all())


class TodoItemRepository(BaseRepository[TodoItem]):
    model = TodoItem

    def list_for_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID, include_done: bool = True) -> list[TodoItem]:
        stmt = select(TodoItem).where(TodoItem.tenant_id == tenant_id, TodoItem.user_id == user_id)
        if not include_done:
            stmt = stmt.where(TodoItem.is_done.is_(False))
        stmt = stmt.order_by(TodoItem.is_done, TodoItem.due_date, TodoItem.created_at)
        return list(self.db.execute(stmt).scalars().all())


class CommunicationLogRepository(BaseRepository[CommunicationLog]):
    model = CommunicationLog

    def recent(self, tenant_id: uuid.UUID, limit: int = 200) -> list[CommunicationLog]:
        stmt = (
            select(CommunicationLog)
            .where(CommunicationLog.tenant_id == tenant_id)
            .order_by(CommunicationLog.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())
