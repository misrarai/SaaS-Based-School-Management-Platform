import uuid
from datetime import date

from sqlalchemy import extract, func, select

from app.models.academic import Section
from app.models.attendance import Attendance, StaffAttendance, TeacherAttendance
from app.models.schedule import ClassSession
from app.repositories.base import BaseRepository


class AttendanceRepository(BaseRepository[Attendance]):
    model = Attendance

    def list_for_session(self, tenant_id: uuid.UUID, class_session_id: uuid.UUID) -> list[Attendance]:
        stmt = select(Attendance).where(
            Attendance.tenant_id == tenant_id, Attendance.class_session_id == class_session_id
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_for_session_student(
        self, tenant_id: uuid.UUID, class_session_id: uuid.UUID, student_id: uuid.UUID
    ) -> Attendance | None:
        stmt = select(Attendance).where(
            Attendance.tenant_id == tenant_id,
            Attendance.class_session_id == class_session_id,
            Attendance.student_id == student_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_for_student_period(
        self, tenant_id: uuid.UUID, student_id: uuid.UUID, month: int, year: int
    ) -> list[Attendance]:
        stmt = (
            select(Attendance)
            .join(ClassSession, ClassSession.id == Attendance.class_session_id)
            .where(
                Attendance.tenant_id == tenant_id,
                Attendance.student_id == student_id,
                extract("month", ClassSession.session_date) == month,
                extract("year", ClassSession.session_date) == year,
            )
        )
        return list(self.db.execute(stmt).scalars().all())

    def analytics(
        self,
        tenant_id: uuid.UUID,
        section_id: uuid.UUID | None = None,
        class_grade_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> dict:
        stmt = (
            select(Attendance.status, func.count())
            .join(ClassSession, ClassSession.id == Attendance.class_session_id)
            .where(Attendance.tenant_id == tenant_id)
        )
        if section_id is not None:
            stmt = stmt.where(ClassSession.section_id == section_id)
        if class_grade_id is not None:
            stmt = stmt.join(Section, Section.id == ClassSession.section_id).where(
                Section.class_grade_id == class_grade_id
            )
        if date_from is not None:
            stmt = stmt.where(ClassSession.session_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(ClassSession.session_date <= date_to)
        stmt = stmt.group_by(Attendance.status)
        return dict(self.db.execute(stmt).all())


class TeacherAttendanceRepository(BaseRepository[TeacherAttendance]):
    model = TeacherAttendance

    def get_for_teacher_date(
        self, tenant_id: uuid.UUID, teacher_id: uuid.UUID, attendance_date: date
    ) -> TeacherAttendance | None:
        stmt = select(TeacherAttendance).where(
            TeacherAttendance.tenant_id == tenant_id,
            TeacherAttendance.teacher_id == teacher_id,
            TeacherAttendance.attendance_date == attendance_date,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_records(
        self,
        tenant_id: uuid.UUID,
        teacher_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[TeacherAttendance]:
        stmt = select(TeacherAttendance).where(TeacherAttendance.tenant_id == tenant_id)
        if teacher_id is not None:
            stmt = stmt.where(TeacherAttendance.teacher_id == teacher_id)
        if date_from is not None:
            stmt = stmt.where(TeacherAttendance.attendance_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(TeacherAttendance.attendance_date <= date_to)
        stmt = stmt.order_by(TeacherAttendance.attendance_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def counts_for_date(self, tenant_id: uuid.UUID, attendance_date: date) -> dict:
        stmt = (
            select(TeacherAttendance.status, func.count())
            .where(TeacherAttendance.tenant_id == tenant_id, TeacherAttendance.attendance_date == attendance_date)
            .group_by(TeacherAttendance.status)
        )
        return dict(self.db.execute(stmt).all())


class StaffAttendanceRepository(BaseRepository[StaffAttendance]):
    model = StaffAttendance

    def get_for_staff_date(
        self, tenant_id: uuid.UUID, staff_id: uuid.UUID, attendance_date: date
    ) -> StaffAttendance | None:
        stmt = select(StaffAttendance).where(
            StaffAttendance.tenant_id == tenant_id,
            StaffAttendance.staff_id == staff_id,
            StaffAttendance.attendance_date == attendance_date,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_records(
        self,
        tenant_id: uuid.UUID,
        staff_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[StaffAttendance]:
        stmt = select(StaffAttendance).where(StaffAttendance.tenant_id == tenant_id)
        if staff_id is not None:
            stmt = stmt.where(StaffAttendance.staff_id == staff_id)
        if date_from is not None:
            stmt = stmt.where(StaffAttendance.attendance_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(StaffAttendance.attendance_date <= date_to)
        stmt = stmt.order_by(StaffAttendance.attendance_date.desc())
        return list(self.db.execute(stmt).scalars().all())

    def counts_for_date(self, tenant_id: uuid.UUID, attendance_date: date) -> dict:
        stmt = (
            select(StaffAttendance.status, func.count())
            .where(StaffAttendance.tenant_id == tenant_id, StaffAttendance.attendance_date == attendance_date)
            .group_by(StaffAttendance.status)
        )
        return dict(self.db.execute(stmt).all())
