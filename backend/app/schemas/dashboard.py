from datetime import date

from pydantic import BaseModel


class AttendanceTodayOut(BaseModel):
    present: int
    absent: int
    total: int
    percentage: float


class AttendanceTrendPointOut(BaseModel):
    date: date
    percentage: float


class DashboardSummaryOut(BaseModel):
    total_classes: int
    total_teachers: int
    total_students: int
    total_families: int
    total_staff: int

    students_attendance_today: AttendanceTodayOut
    teachers_attendance_today: AttendanceTodayOut
    staff_attendance_today: AttendanceTodayOut
    # Last 7 days of student attendance %, oldest first — powers the dashboard trend chart.
    attendance_trend: list[AttendanceTrendPointOut]

    fees_collected_this_month: float
    fees_pending: float
    fees_overdue: float

    online_classes_today: int
