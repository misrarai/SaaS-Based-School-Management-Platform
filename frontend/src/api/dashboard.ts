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
}

export function getDashboardSummary() {
  return apiClient.get<DashboardSummary>("/dashboard/summary").then((res) => res.data);
}
