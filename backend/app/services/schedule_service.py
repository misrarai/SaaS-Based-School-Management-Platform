import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.notification import NotificationChannel
from app.models.schedule import ClassSchedule, ClassSession, MeetingStatus, SessionStatus
from app.repositories.academic_repo import SectionRepository, SubjectRepository
from app.repositories.schedule_repo import ClassScheduleRepository, ClassSessionRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.schedule import ClassScheduleCreate, ClassScheduleUpdate, ClassSessionUpdate, OnlineClassCreate
from app.services.google_calendar_service import GoogleCalendarService
from app.services.notification_service import NotificationService

# The project serves Pakistani schools exclusively — every Google Calendar event is created and
# displayed in this timezone regardless of the server's own local time (see GOOGLE_TIMEZONE note
# in google_calendar_service.py's event body).
KARACHI_TZ = ZoneInfo("Asia/Karachi")


class ScheduleService:
    def __init__(self, db: Session):
        self.db = db
        self.schedules = ClassScheduleRepository(db)
        self.sessions = ClassSessionRepository(db)
        self.sections = SectionRepository(db)
        self.subjects = SubjectRepository(db)
        self.teachers = TeacherProfileRepository(db)
        self.student_profiles = StudentProfileRepository(db)
        self.google_calendar = GoogleCalendarService(db)
        self.notifications = NotificationService(db)

    def _validate_refs(
        self, tenant_id: uuid.UUID, section_id: uuid.UUID, subject_id: uuid.UUID, teacher_id: uuid.UUID
    ) -> None:
        if self.sections.get_by_id(tenant_id, section_id) is None:
            raise NotFoundError("Section not found")
        if self.subjects.get_by_id(tenant_id, subject_id) is None:
            raise NotFoundError("Subject not found")
        if self.teachers.get_by_id(tenant_id, teacher_id) is None:
            raise NotFoundError("Teacher not found")

    def create_schedule(self, tenant_id: uuid.UUID, payload: ClassScheduleCreate) -> ClassSchedule:
        self._validate_refs(tenant_id, payload.section_id, payload.subject_id, payload.teacher_id)
        if payload.end_time <= payload.start_time:
            raise ConflictError("End time must be after start time")
        schedule = self.schedules.create(
            ClassSchedule(
                tenant_id=tenant_id,
                section_id=payload.section_id,
                subject_id=payload.subject_id,
                teacher_id=payload.teacher_id,
                day_of_week=payload.day_of_week,
                start_time=payload.start_time,
                end_time=payload.end_time,
                default_meeting_url=payload.default_meeting_url,
            )
        )
        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    @staticmethod
    def _combine_karachi(session_date: date, t: time) -> datetime:
        return datetime.combine(session_date, t, tzinfo=KARACHI_TZ)

    def create_online_class(self, tenant_id: uuid.UUID, payload: OnlineClassCreate) -> ClassSession:
        """The ad-hoc "Create Online Class" flow: makes one dated session and immediately tries
        to generate a Google Meet link for it. A Google failure (not connected, API error, etc.)
        never blocks class creation — the session is still created with meeting_status FAILED and
        no meet_link, and the admin/teacher can retry via generate_meet_link once fixed."""
        self._validate_refs(tenant_id, payload.section_id, payload.subject_id, payload.teacher_id)
        if payload.end_time <= payload.start_time:
            raise ConflictError("End time must be after start time")

        session = self.sessions.create(
            ClassSession(
                tenant_id=tenant_id,
                section_id=payload.section_id,
                subject_id=payload.subject_id,
                teacher_id=payload.teacher_id,
                session_date=payload.session_date,
                start_time=payload.start_time,
                end_time=payload.end_time,
                title=payload.title,
                description=payload.description,
            )
        )
        self.db.commit()
        self.db.refresh(session)

        self._sync_google_meet(session)

        if payload.notify_channel is not None:
            self._notify_section(session, payload.notify_channel)

        return session

    def _notify_section(self, session: ClassSession, channel: NotificationChannel) -> None:
        """Best-effort: tells every active student's parent in the section about the class, via
        exactly the one channel the caller picked — never both, same rule as the admin's other
        one-channel notification tool. A failure here must not undo the class that was already
        created, so any error is swallowed (NotificationService itself never raises for delivery
        failures — this only guards against something unexpected, e.g. a bad section)."""
        message = f"Your {session.title or 'online'} class is scheduled for {session.session_date.strftime('%d %B %Y')} at {session.start_time.strftime('%I:%M %p')}."
        if session.meet_link:
            message += f"\n\nJoin Google Meet:\n{session.meet_link}"
        try:
            students = self.student_profiles.list_with_users(session.tenant_id, section_id=session.section_id, status="active")
            for profile, _user in students:
                self.notifications.send_notification(
                    session.tenant_id, profile.id, session.title or "Online Class", message, channel
                )
        except Exception:
            pass

    def _sync_google_meet(self, session: ClassSession) -> None:
        """Creates a fresh Google Meet event for a session that doesn't have one yet. request_id
        is the session's own id — stable and unique per session, satisfying the "unique request
        id per event" requirement without needing any extra idempotency-key bookkeeping."""
        result = self.google_calendar.create_meet_event(
            session.tenant_id,
            summary=session.title or "Online Class",
            description=session.description or "",
            start_dt=self._combine_karachi(session.session_date, session.start_time),
            end_dt=self._combine_karachi(session.session_date, session.end_time),
            request_id=str(session.id),
        )
        if result.success:
            session.google_event_id = result.event_id
            session.meet_link = result.meet_link
            session.google_calendar_id = result.calendar_id
            session.meeting_status = MeetingStatus.CREATED
            # Keep the generic join-link field (used by every existing Join-class UI) in sync so
            # nothing else in the app needs to change to pick up the new Meet link.
            session.meeting_url = result.meet_link
        else:
            session.meeting_status = MeetingStatus.FAILED
        self.db.commit()
        self.db.refresh(session)

    def generate_meet_link(self, tenant_id: uuid.UUID, session_id: uuid.UUID, force: bool = False) -> ClassSession:
        """Idempotent by default: a session that already has a google_event_id + meet_link is
        left untouched unless force=True, so retried/duplicate requests never create a second
        Google Calendar event for the same class."""
        session = self.get_session_or_404(tenant_id, session_id)
        if session.google_event_id and session.meet_link and not force:
            return session

        if force and session.google_event_id and session.google_calendar_id:
            self.google_calendar.delete_calendar_event(tenant_id, session.google_event_id, session.google_calendar_id)
            session.google_event_id = None
            session.meet_link = None

        self._sync_google_meet(session)
        return session

    def list_schedules(self, tenant_id: uuid.UUID) -> list[ClassSchedule]:
        return self.schedules.list(tenant_id)

    def update_schedule(
        self, tenant_id: uuid.UUID, schedule_id: uuid.UUID, payload: ClassScheduleUpdate
    ) -> ClassSchedule:
        schedule = self.schedules.get_by_id(tenant_id, schedule_id)
        if schedule is None:
            raise NotFoundError("Schedule not found")
        for field in ("day_of_week", "start_time", "end_time", "default_meeting_url", "is_active"):
            value = getattr(payload, field)
            if value is not None:
                setattr(schedule, field, value)
        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    def generate_sessions(self, tenant_id: uuid.UUID, start_date: date, end_date: date) -> list[ClassSession]:
        if end_date < start_date:
            raise ConflictError("end_date must be on or after start_date")
        created: list[ClassSession] = []
        active_schedules = self.schedules.list_active(tenant_id)
        current = start_date
        while current <= end_date:
            for sch in active_schedules:
                if sch.day_of_week != current.weekday():
                    continue
                if self.sessions.exists_for_schedule_date(tenant_id, sch.id, current):
                    continue
                session = self.sessions.create(
                    ClassSession(
                        tenant_id=tenant_id,
                        class_schedule_id=sch.id,
                        section_id=sch.section_id,
                        subject_id=sch.subject_id,
                        teacher_id=sch.teacher_id,
                        session_date=current,
                        start_time=sch.start_time,
                        end_time=sch.end_time,
                        meeting_url=sch.default_meeting_url,
                    )
                )
                created.append(session)
            current += timedelta(days=1)
        self.db.commit()
        for session in created:
            self.db.refresh(session)
        return created

    def get_session_or_404(self, tenant_id: uuid.UUID, session_id: uuid.UUID) -> ClassSession:
        session = self.sessions.get_by_id(tenant_id, session_id)
        if session is None:
            raise NotFoundError("Session not found")
        return session

    def _teacher_profile_id_for_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> uuid.UUID:
        profile = self.teachers.get_by_user_id(tenant_id, user_id)
        if profile is None:
            raise ForbiddenError("Not a teacher")
        return profile.id

    def update_session(self, tenant_id: uuid.UUID, session_id: uuid.UUID, payload: ClassSessionUpdate) -> ClassSession:
        session = self.get_session_or_404(tenant_id, session_id)
        google_relevant_fields = ("title", "description", "session_date", "start_time", "end_time")
        changed_google_fields = any(getattr(payload, f) is not None for f in google_relevant_fields)

        for field in (
            "title", "description", "meeting_url", "session_date", "start_time", "end_time", "status", "cancellation_reason",
        ):
            value = getattr(payload, field)
            if value is not None:
                setattr(session, field, value)
        self.db.commit()
        self.db.refresh(session)

        # Keep the Google Calendar event in sync rather than creating a new one — only relevant
        # once a Meet event actually exists for this session.
        if changed_google_fields and session.google_event_id and session.google_calendar_id:
            result = self.google_calendar.update_calendar_event(
                tenant_id,
                session.google_event_id,
                session.google_calendar_id,
                summary=session.title or "Online Class",
                description=session.description or "",
                start_dt=self._combine_karachi(session.session_date, session.start_time),
                end_dt=self._combine_karachi(session.session_date, session.end_time),
            )
            if result.success:
                session.meeting_status = MeetingStatus.CREATED
            else:
                session.meeting_status = MeetingStatus.FAILED
            self.db.commit()
            self.db.refresh(session)
        return session

    def delete_session(self, tenant_id: uuid.UUID, session_id: uuid.UUID) -> None:
        """Soft-delete: cancels the Google Calendar event (if one exists) and marks the session
        CANCELLED rather than removing the row outright, since attendance and other records may
        already reference it — same convention the rest of this app uses for "deleting" a class
        (SessionStatus.CANCELLED + cancellation_reason)."""
        session = self.get_session_or_404(tenant_id, session_id)
        if session.google_event_id and session.google_calendar_id:
            self.google_calendar.delete_calendar_event(tenant_id, session.google_event_id, session.google_calendar_id)
            session.google_event_id = None
            session.meet_link = None
            session.meeting_status = MeetingStatus.CANCELLED
        session.status = SessionStatus.CANCELLED
        session.cancellation_reason = session.cancellation_reason or "Deleted by admin"
        self.db.commit()

    def start_session(self, tenant_id: uuid.UUID, session_id: uuid.UUID, teacher_user_id: uuid.UUID) -> ClassSession:
        session = self.get_session_or_404(tenant_id, session_id)
        teacher_profile_id = self._teacher_profile_id_for_user(tenant_id, teacher_user_id)
        if session.teacher_id != teacher_profile_id:
            raise ForbiddenError("You do not teach this session")
        session.status = SessionStatus.LIVE
        session.actual_start_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(session)
        return session

    def end_session(self, tenant_id: uuid.UUID, session_id: uuid.UUID, teacher_user_id: uuid.UUID) -> ClassSession:
        session = self.get_session_or_404(tenant_id, session_id)
        teacher_profile_id = self._teacher_profile_id_for_user(tenant_id, teacher_user_id)
        if session.teacher_id != teacher_profile_id:
            raise ForbiddenError("You do not teach this session")
        session.status = SessionStatus.COMPLETED
        session.actual_end_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(session)
        return session

    def list_sessions_for_role(
        self,
        tenant_id: uuid.UUID,
        *,
        teacher_id: uuid.UUID | None = None,
        section_id: uuid.UUID | None = None,
        section_ids: list[uuid.UUID] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[ClassSession]:
        if section_ids:
            results: list[ClassSession] = []
            for sid in section_ids:
                results.extend(
                    self.sessions.list_sessions(tenant_id, section_id=sid, date_from=date_from, date_to=date_to)
                )
            results.sort(key=lambda s: (s.session_date, s.start_time))
            return results
        return self.sessions.list_sessions(
            tenant_id, teacher_id=teacher_id, section_id=section_id, date_from=date_from, date_to=date_to
        )
