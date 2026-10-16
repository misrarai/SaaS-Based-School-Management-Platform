import uuid
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.repositories.academic_repo import ClassGradeRepository
from app.repositories.family_repo import FamilyRepository
from app.repositories.staff_repo import StaffRepository
from app.repositories.student_repo import StudentProfileRepository
from app.repositories.teacher_repo import TeacherProfileRepository
from app.services.attendance_service import AttendanceService, HrAttendanceService
from app.services.dashboard_overview import DashboardOverviewBuilder
from app.services.fee_service import FeeService
from app.services.schedule_service import ScheduleService

TREND_DAYS = 7


class DashboardService:
    """Composes the admin dashboard's overview purely by calling into the existing per-domain
    services/repositories (fees, attendance, HR attendance, schedule, academics) — no new
    business logic or direct DB writes live here, just aggregation for one screen."""

    def __init__(self, db: Session):
        self.db = db
        self.class_grades = ClassGradeRepository(db)
        self.teachers = TeacherProfileRepository(db)
        self.students = StudentProfileRepository(db)
        self.families = FamilyRepository(db)
        self.staff = StaffRepository(db)
        self.attendance = AttendanceService(db)
        self.hr_attendance = HrAttendanceService(db)
        self.fees = FeeService(db)
        self.schedule = ScheduleService(db)

    @staticmethod
    def _student_attendance_today(counts: dict) -> dict:
        return {
            "present": counts["present"] + counts["late"],
            "absent": counts["absent"] + counts["excused"],
            "total": counts["total"],
            "percentage": counts["percentage"],
        }

    @staticmethod
    def _hr_attendance_today(counts: dict) -> dict:
        return {
            "present": counts["present"] + counts["late"],
            "absent": counts["absent"] + counts["half_day"] + counts["leave"],
            "total": counts["total"],
            "percentage": counts["percentage"],
        }

    def get_summary(self, tenant_id: uuid.UUID) -> dict:
        today = date.today()

        total_classes = len(self.class_grades.list(tenant_id))
        total_teachers = len(self.teachers.list(tenant_id))
        total_students = len(self.students.list_with_users(tenant_id, status="active"))
        total_families = len(self.families.list(tenant_id))
        total_staff = len(self.staff.search(tenant_id, status="active"))

        student_counts = self.attendance.get_class_analytics(tenant_id, date_from=today, date_to=today)
        teacher_counts = self.hr_attendance.get_teacher_daily_summary(tenant_id, today)
        staff_counts = self.hr_attendance.get_staff_daily_summary(tenant_id, today)

        trend = []
        for offset in range(TREND_DAYS - 1, -1, -1):
            day = today - timedelta(days=offset)
            day_counts = self.attendance.get_class_analytics(tenant_id, date_from=day, date_to=day)
            trend.append({"date": day, "percentage": day_counts["percentage"]})

        fee_summary = self.fees.get_report_summary(tenant_id, today.month, today.year)

        sessions_today = self.schedule.list_sessions_for_role(tenant_id, date_from=today, date_to=today)

        return {
            "total_classes": total_classes,
            "total_teachers": total_teachers,
            "total_students": total_students,
            "total_families": total_families,
            "total_staff": total_staff,
            "students_attendance_today": self._student_attendance_today(student_counts),
            "teachers_attendance_today": self._hr_attendance_today(teacher_counts),
            "staff_attendance_today": self._hr_attendance_today(staff_counts),
            "attendance_trend": trend,
            "fees_collected_this_month": fee_summary.total_collected,
            "fees_pending": fee_summary.total_pending,
            "fees_overdue": fee_summary.total_overdue,
            "online_classes_today": len(sessions_today),
            "overview": DashboardOverviewBuilder(self.db).build(tenant_id, today),
        }
