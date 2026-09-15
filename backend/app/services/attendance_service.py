import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.attendance import Attendance, AttendanceStatus, HrAttendanceStatus, StaffAttendance, TeacherAttendance
from app.models.schedule import ClassSession
from app.repositories.attendance_repo import AttendanceRepository, StaffAttendanceRepository, TeacherAttendanceRepository
from app.repositories.schedule_repo import ClassSessionRepository
from app.repositories.staff_repo import StaffRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.schemas.attendance import AttendanceRecordIn, BulkMarkStaffAttendanceRequest


class AttendanceService:
    def __init__(self, db: Session):
        self.db = db
        self.attendance = AttendanceRepository(db)
        self.sessions = ClassSessionRepository(db)
        self.student_profiles = StudentProfileRepository(db)
        self.teachers = TeacherProfileRepository(db)

    def _session_or_404(self, tenant_id: uuid.UUID, session_id: uuid.UUID) -> ClassSession:
        session = self.sessions.get_by_id(tenant_id, session_id)
        if session is None:
            raise NotFoundError("Session not found")
        return session

    def _assert_teacher_owns_session(self, tenant_id: uuid.UUID, session: ClassSession, teacher_user_id: uuid.UUID) -> None:
        profile = self.teachers.get_by_user_id(tenant_id, teacher_user_id)
        if profile is None or session.teacher_id != profile.id:
            raise ForbiddenError("You do not teach this session")

    def get_roster_for_session(self, tenant_id: uuid.UUID, session_id: uuid.UUID, teacher_user_id: uuid.UUID) -> list[dict]:
        session = self._session_or_404(tenant_id, session_id)
        self._assert_teacher_owns_session(tenant_id, session, teacher_user_id)

        students = self.student_profiles.list_with_users(tenant_id, section_id=session.section_id, status="active")
        marks = {a.student_id: a for a in self.attendance.list_for_session(tenant_id, session_id)}
        return [
            {
                "student_id": profile.id,
                "full_name": user.full_name,
                "roll_number": profile.roll_number,
                "status": marks[profile.id].status if profile.id in marks else None,
                "note": marks[profile.id].note if profile.id in marks else None,
            }
            for profile, user in students
        ]

    def mark_attendance(
        self, tenant_id: uuid.UUID, session_id: uuid.UUID, teacher_user_id: uuid.UUID, records: list[AttendanceRecordIn]
    ) -> list[Attendance]:
        session = self._session_or_404(tenant_id, session_id)
        self._assert_teacher_owns_session(tenant_id, session, teacher_user_id)

        now = datetime.now(timezone.utc)
        results: list[Attendance] = []
        for record in records:
            existing = self.attendance.get_for_session_student(tenant_id, session_id, record.student_id)
            if existing is not None:
                existing.status = record.status
                existing.note = record.note
                existing.marked_by_user_id = teacher_user_id
                existing.marked_at = now
                results.append(existing)
            else:
                created = self.attendance.create(
                    Attendance(
                        tenant_id=tenant_id,
                        class_session_id=session_id,
                        student_id=record.student_id,
                        status=record.status,
                        marked_by_user_id=teacher_user_id,
                        marked_at=now,
                        note=record.note,
                    )
                )
                results.append(created)
        self.db.commit()
        for r in results:
            self.db.refresh(r)
        return results

    def get_student_monthly_summary(self, tenant_id: uuid.UUID, student_id: uuid.UUID, month: int, year: int) -> dict:
        records = self.attendance.list_for_student_period(tenant_id, student_id, month, year)
        counts = {status: 0 for status in AttendanceStatus}
        for r in records:
            counts[r.status] += 1
        total = len(records)
        present_like = counts[AttendanceStatus.PRESENT] + counts[AttendanceStatus.LATE]
        percentage = round((present_like / total) * 100, 1) if total else 0.0
        return {
            "present": counts[AttendanceStatus.PRESENT],
            "absent": counts[AttendanceStatus.ABSENT],
            "late": counts[AttendanceStatus.LATE],
            "excused": counts[AttendanceStatus.EXCUSED],
            "total": total,
            "percentage": percentage,
        }

    def get_class_analytics(
        self,
        tenant_id: uuid.UUID,
        section_id: uuid.UUID | None = None,
        class_grade_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> dict:
        counts = self.attendance.analytics(
            tenant_id, section_id=section_id, class_grade_id=class_grade_id, date_from=date_from, date_to=date_to
        )
        present = counts.get(AttendanceStatus.PRESENT, 0)
        absent = counts.get(AttendanceStatus.ABSENT, 0)
        late = counts.get(AttendanceStatus.LATE, 0)
        excused = counts.get(AttendanceStatus.EXCUSED, 0)
        total = present + absent + late + excused
        percentage = round(((present + late) / total) * 100, 1) if total else 0.0
        return {"present": present, "absent": absent, "late": late, "excused": excused, "total": total, "percentage": percentage}


def _hr_summary(counts: dict) -> dict:
    present = counts.get(HrAttendanceStatus.PRESENT, 0)
    absent = counts.get(HrAttendanceStatus.ABSENT, 0)
    late = counts.get(HrAttendanceStatus.LATE, 0)
    half_day = counts.get(HrAttendanceStatus.HALF_DAY, 0)
    leave = counts.get(HrAttendanceStatus.LEAVE, 0)
    total = present + absent + late + half_day + leave
    percentage = round(((present + late) / total) * 100, 1) if total else 0.0
    return {
        "present": present, "absent": absent, "late": late, "half_day": half_day, "leave": leave,
        "total": total, "percentage": percentage,
    }


class HrAttendanceService:
    """Attendance for the people who work at the school, not students — teachers self check-in
    (they already have logins), staff are marked by an admin (they have none). Deliberately kept
    separate from AttendanceService above, which is entirely student/class-session shaped; the
    two share nothing but the general "attendance" domain."""

    def __init__(self, db: Session):
        self.db = db
        self.teacher_attendance = TeacherAttendanceRepository(db)
        self.staff_attendance = StaffAttendanceRepository(db)
        self.teachers = TeacherProfileRepository(db)
        self.staff = StaffRepository(db)

    def _teacher_profile_id_for_user(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> uuid.UUID:
        profile = self.teachers.get_by_user_id(tenant_id, user_id)
        if profile is None:
            raise ForbiddenError("Not a teacher")
        return profile.id

    # --- Teacher self check-in/out ---

    def teacher_check_in(self, tenant_id: uuid.UUID, teacher_user_id: uuid.UUID) -> TeacherAttendance:
        teacher_id = self._teacher_profile_id_for_user(tenant_id, teacher_user_id)
        today = date.today()
        existing = self.teacher_attendance.get_for_teacher_date(tenant_id, teacher_id, today)
        if existing is not None and existing.check_in_at is not None:
            raise ConflictError("Already checked in today")

        now = datetime.now(timezone.utc)
        if existing is not None:
            existing.check_in_at = now
            existing.status = HrAttendanceStatus.PRESENT
            record = existing
        else:
            record = self.teacher_attendance.create(
                TeacherAttendance(
                    tenant_id=tenant_id, teacher_id=teacher_id, attendance_date=today,
                    status=HrAttendanceStatus.PRESENT, check_in_at=now,
                )
            )
        self.db.commit()
        self.db.refresh(record)
        return record

    def teacher_check_out(self, tenant_id: uuid.UUID, teacher_user_id: uuid.UUID) -> TeacherAttendance:
        teacher_id = self._teacher_profile_id_for_user(tenant_id, teacher_user_id)
        today = date.today()
        record = self.teacher_attendance.get_for_teacher_date(tenant_id, teacher_id, today)
        if record is None or record.check_in_at is None:
            raise ConflictError("You have not checked in today")
        if record.check_out_at is not None:
            raise ConflictError("Already checked out today")
        record.check_out_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_teacher_today(self, tenant_id: uuid.UUID, teacher_user_id: uuid.UUID) -> TeacherAttendance | None:
        teacher_id = self._teacher_profile_id_for_user(tenant_id, teacher_user_id)
        return self.teacher_attendance.get_for_teacher_date(tenant_id, teacher_id, date.today())

    def list_my_teacher_attendance(
        self, tenant_id: uuid.UUID, teacher_user_id: uuid.UUID, date_from: date | None, date_to: date | None
    ) -> list[TeacherAttendance]:
        teacher_id = self._teacher_profile_id_for_user(tenant_id, teacher_user_id)
        return self.teacher_attendance.list_records(tenant_id, teacher_id=teacher_id, date_from=date_from, date_to=date_to)

    # --- Admin: teacher overrides + staff register ---

    def admin_mark_teacher_attendance(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID, attendance_date: date,
        status: HrAttendanceStatus, note: str | None, marked_by_user_id: uuid.UUID,
    ) -> TeacherAttendance:
        if self.teachers.get_by_id(tenant_id, teacher_id) is None:
            raise NotFoundError("Teacher not found")
        existing = self.teacher_attendance.get_for_teacher_date(tenant_id, teacher_id, attendance_date)
        if existing is not None:
            existing.status = status
            existing.note = note
            existing.marked_by_user_id = marked_by_user_id
            record = existing
        else:
            record = self.teacher_attendance.create(
                TeacherAttendance(
                    tenant_id=tenant_id, teacher_id=teacher_id, attendance_date=attendance_date,
                    status=status, note=note, marked_by_user_id=marked_by_user_id,
                )
            )
        self.db.commit()
        self.db.refresh(record)
        return record

    def list_teacher_attendance_detailed(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID | None, date_from: date | None, date_to: date | None
    ) -> list[dict]:
        records = self.teacher_attendance.list_records(tenant_id, teacher_id=teacher_id, date_from=date_from, date_to=date_to)
        out = []
        for r in records:
            found = self.teachers.get_with_user(tenant_id, r.teacher_id)
            name = found[1].full_name if found is not None else "Unknown teacher"
            out.append({**{c.name: getattr(r, c.name) for c in r.__table__.columns}, "teacher_name": name})
        return out

    def get_teacher_daily_summary(self, tenant_id: uuid.UUID, attendance_date: date) -> dict:
        return _hr_summary(self.teacher_attendance.counts_for_date(tenant_id, attendance_date))

    def mark_staff_attendance(
        self, tenant_id: uuid.UUID, staff_id: uuid.UUID, attendance_date: date,
        status: HrAttendanceStatus, note: str | None, marked_by_user_id: uuid.UUID,
    ) -> StaffAttendance:
        if self.staff.get_by_id(tenant_id, staff_id) is None:
            raise NotFoundError("Staff member not found")
        now = datetime.now(timezone.utc)
        existing = self.staff_attendance.get_for_staff_date(tenant_id, staff_id, attendance_date)
        if existing is not None:
            existing.status = status
            existing.note = note
            existing.marked_by_user_id = marked_by_user_id
            existing.marked_at = now
            record = existing
        else:
            record = self.staff_attendance.create(
                StaffAttendance(
                    tenant_id=tenant_id, staff_id=staff_id, attendance_date=attendance_date,
                    status=status, note=note, marked_by_user_id=marked_by_user_id, marked_at=now,
                )
            )
        self.db.commit()
        self.db.refresh(record)
        return record

    def bulk_mark_staff_attendance(
        self, tenant_id: uuid.UUID, payload: BulkMarkStaffAttendanceRequest, marked_by_user_id: uuid.UUID
    ) -> list[StaffAttendance]:
        return [
            self.mark_staff_attendance(
                tenant_id, record.staff_id, payload.attendance_date, record.status, record.note, marked_by_user_id
            )
            for record in payload.records
        ]

    def get_staff_daily_roster(self, tenant_id: uuid.UUID, attendance_date: date) -> list[dict]:
        staff_members = self.staff.search(tenant_id, status="active")
        marks = {
            m.staff_id: m for m in self.staff_attendance.list_records(tenant_id, date_from=attendance_date, date_to=attendance_date)
        }
        return [
            {
                "staff_id": s.id,
                "full_name": s.full_name,
                "designation": s.designation,
                "status": marks[s.id].status if s.id in marks else None,
                "note": marks[s.id].note if s.id in marks else None,
            }
            for s in staff_members
        ]

    def list_staff_attendance_detailed(
        self, tenant_id: uuid.UUID, staff_id: uuid.UUID | None, date_from: date | None, date_to: date | None
    ) -> list[dict]:
        records = self.staff_attendance.list_records(tenant_id, staff_id=staff_id, date_from=date_from, date_to=date_to)
        out = []
        for r in records:
            s = self.staff.get_by_id(tenant_id, r.staff_id)
            out.append({
                **{c.name: getattr(r, c.name) for c in r.__table__.columns},
                "staff_name": s.full_name if s is not None else "Unknown staff",
                "designation": s.designation if s is not None else "",
            })
        return out

    def get_staff_daily_summary(self, tenant_id: uuid.UUID, attendance_date: date) -> dict:
        return _hr_summary(self.staff_attendance.counts_for_date(tenant_id, attendance_date))
