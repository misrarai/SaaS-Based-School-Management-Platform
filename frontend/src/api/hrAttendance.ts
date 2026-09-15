import { apiClient } from "./client";

export type HrAttendanceStatus = "present" | "absent" | "late" | "half_day" | "leave";

export interface HrAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  half_day: number;
  leave: number;
  total: number;
  percentage: number;
}

export interface TeacherAttendance {
  id: string;
  teacher_id: string;
  attendance_date: string;
  status: HrAttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  marked_by_user_id: string | null;
  note: string | null;
}

export interface TeacherAttendanceDetail extends TeacherAttendance {
  teacher_name: string;
}

export interface StaffAttendance {
  id: string;
  staff_id: string;
  attendance_date: string;
  status: HrAttendanceStatus;
  marked_by_user_id: string;
  marked_at: string;
  note: string | null;
}

export interface StaffAttendanceDetail extends StaffAttendance {
  staff_name: string;
  designation: string;
}

export interface StaffDailyRosterEntry {
  staff_id: string;
  full_name: string;
  designation: string;
  status: HrAttendanceStatus | null;
  note: string | null;
}

// --- Teacher self check-in/out ---

export function teacherCheckIn() {
  return apiClient.post<TeacherAttendance>("/attendance/teachers/check-in").then((res) => res.data);
}

export function teacherCheckOut() {
  return apiClient.post<TeacherAttendance>("/attendance/teachers/check-out").then((res) => res.data);
}

export function getMyTeacherAttendanceToday() {
  return apiClient
    .get<TeacherAttendance | null>("/attendance/teachers/me/today")
    .then((res) => res.data);
}

export function listMyTeacherAttendance(dateFrom?: string, dateTo?: string) {
  return apiClient
    .get<TeacherAttendance[]>("/attendance/teachers/me", { params: { date_from: dateFrom, date_to: dateTo } })
    .then((res) => res.data);
}

// --- Admin: teacher attendance ---

export function listTeacherAttendance(filters?: { teacherId?: string; dateFrom?: string; dateTo?: string }) {
  return apiClient
    .get<TeacherAttendanceDetail[]>("/attendance/teachers", {
      params: { teacher_id: filters?.teacherId, date_from: filters?.dateFrom, date_to: filters?.dateTo },
    })
    .then((res) => res.data);
}

export function adminMarkTeacherAttendance(payload: {
  teacher_id: string;
  attendance_date: string;
  status: HrAttendanceStatus;
  note?: string;
}) {
  return apiClient.post<TeacherAttendance>("/attendance/teachers/mark", payload).then((res) => res.data);
}

export function getTeacherAttendanceSummary(date?: string) {
  return apiClient
    .get<HrAttendanceSummary>("/attendance/teachers/summary", { params: { date } })
    .then((res) => res.data);
}

// --- Admin: staff attendance (daily register) ---

export function getStaffDailyRoster(date?: string) {
  return apiClient.get<StaffDailyRosterEntry[]>("/attendance/staff/roster", { params: { date } }).then((res) => res.data);
}

export function markStaffAttendance(payload: {
  staff_id: string;
  attendance_date: string;
  status: HrAttendanceStatus;
  note?: string;
}) {
  return apiClient.post<StaffAttendance>("/attendance/staff/mark", payload).then((res) => res.data);
}

export function bulkMarkStaffAttendance(payload: {
  attendance_date: string;
  records: { staff_id: string; status: HrAttendanceStatus; note?: string }[];
}) {
  return apiClient.post<StaffAttendance[]>("/attendance/staff/bulk-mark", payload).then((res) => res.data);
}

export function listStaffAttendance(filters?: { staffId?: string; dateFrom?: string; dateTo?: string }) {
  return apiClient
    .get<StaffAttendanceDetail[]>("/attendance/staff", {
      params: { staff_id: filters?.staffId, date_from: filters?.dateFrom, date_to: filters?.dateTo },
    })
    .then((res) => res.data);
}

export function getStaffAttendanceSummary(date?: string) {
  return apiClient
    .get<HrAttendanceSummary>("/attendance/staff/summary", { params: { date } })
    .then((res) => res.data);
}
