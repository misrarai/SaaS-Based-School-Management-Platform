import { apiClient } from "./client";

export interface AttendanceToday {
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface AttendanceTrendPoint {
  date: string;
  percentage: number;
}

export interface DashboardSummary {
  total_classes: number;
  total_teachers: number;
  total_students: number;
  total_families: number;
  total_staff: number;
  students_attendance_today: AttendanceToday;
  teachers_attendance_today: AttendanceToday;
  staff_attendance_today: AttendanceToday;
  attendance_trend: AttendanceTrendPoint[];
  fees_collected_this_month: number;
  fees_pending: number;
  fees_overdue: number;
  online_classes_today: number;
  overview?: DashboardOverview;
}

export function getDashboardSummary() {
  return apiClient.get<DashboardSummary>("/dashboard/summary").then((res) => res.data);
}

export interface StudentAttendanceBreakdown {
  present: number;
  absent: number;
  late: number;
  leave: number;
  not_marked: number;
  total: number;
}

export interface HrAttendanceBreakdown {
  present: number;
  absent: number;
  late: number;
  half_day: number;
  leave: number;
  not_marked: number;
  total: number;
}

export interface ReceivableReport {
  year: number;
  previous_balance: number;
  months: { month: number; amount: number }[];
  next_year_balance: number;
  total: number;
}

export interface DailyCashFlow {
  day: number;
  cash_in: number;
  cash_out: number;
}

export interface DailyAdmissions {
  day: number;
  admissions: number;
  withdrawals: number;
}

export interface ChannelUsage {
  channel: string;
  sent: number;
  total: number;
}

export interface DashboardOverview {
  total_students_all: number;
  active_families: number;
  active_staff_all: number;
  total_staff_all: number;
  fee_this_month: number;
  received_this_month: number;
  receivable_this_month: number;
  total_receivable: number;
  payout_period_month: number;
  payout_period_year: number;
  salary_last_month: number;
  paid_last_month: number;
  total_payable: number;
  today_collection: number;
  today_payments_count: number;
  pending_verification_count: number;
  pending_verification_amount: number;
  birthdays_today: string[];
  messaging_today: ChannelUsage[];
  receivable_report: ReceivableReport;
  student_attendance: StudentAttendanceBreakdown;
  hr_attendance: HrAttendanceBreakdown;
  cash_flow: DailyCashFlow[];
  admissions: DailyAdmissions[];
}
