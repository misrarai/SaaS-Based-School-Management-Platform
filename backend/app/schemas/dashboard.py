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

    # --- Extended overview (tile grid, report panels, monthly charts) ---
    overview: "DashboardOverviewOut"


class StudentAttendanceBreakdownOut(BaseModel):
    present: int
    absent: int
    late: int
    leave: int
    not_marked: int
    total: int


class HrAttendanceBreakdownOut(BaseModel):
    present: int
    absent: int
    late: int
    half_day: int
    leave: int
    not_marked: int
    total: int


class ReceivableMonthOut(BaseModel):
    month: int
    amount: float


class ReceivableReportOut(BaseModel):
    year: int
    previous_balance: float
    months: list[ReceivableMonthOut]
    next_year_balance: float
    total: float


class DailyCashFlowOut(BaseModel):
    day: int
    cash_in: float
    cash_out: float


class DailyAdmissionsOut(BaseModel):
    day: int
    admissions: int
    withdrawals: int


class ChannelUsageOut(BaseModel):
    channel: str
    sent: int
    total: int


class DashboardOverviewOut(BaseModel):
    total_students_all: int
    active_families: int
    active_staff_all: int
    total_staff_all: int

    fee_this_month: float
    received_this_month: float
    receivable_this_month: float
    total_receivable: float

    payout_period_month: int
    payout_period_year: int
    salary_last_month: float
    paid_last_month: float
    total_payable: float

    today_collection: float
    today_payments_count: int
    pending_verification_count: int
    pending_verification_amount: float

    birthdays_today: list[str]

    messaging_today: list[ChannelUsageOut]
    receivable_report: ReceivableReportOut
    student_attendance: StudentAttendanceBreakdownOut
    hr_attendance: HrAttendanceBreakdownOut
    cash_flow: list[DailyCashFlowOut]
    admissions: list[DailyAdmissionsOut]


DashboardSummaryOut.model_rebuild()
