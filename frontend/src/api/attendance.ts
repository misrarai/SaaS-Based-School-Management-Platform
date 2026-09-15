import { apiClient } from "./client";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface RosterEntry {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  status: AttendanceStatus | null;
  note: string | null;
}

export interface AttendanceRecord {
  id: string;
  class_session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_by_user_id: string;
  marked_at: string;
  note: string | null;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percentage: number;
}

export function getRoster(sessionId: string) {
  return apiClient.get<RosterEntry[]>(`/attendance/sessions/${sessionId}/roster`).then((res) => res.data);
}

export function markAttendance(
  sessionId: string,
  records: { student_id: string; status: AttendanceStatus; note?: string }[],
) {
  return apiClient
    .post<AttendanceRecord[]>(`/attendance/sessions/${sessionId}`, { records })
    .then((res) => res.data);
}

export function getStudentSummary(studentId: string, month: number, year: number) {
  return apiClient
    .get<AttendanceSummary>(`/attendance/students/${studentId}/summary`, { params: { month, year } })
    .then((res) => res.data);
}

export function getAnalytics(filters?: {
  sectionId?: string;
  classGradeId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = {
    section_id: filters?.sectionId || undefined,
    class_grade_id: filters?.classGradeId || undefined,
    date_from: filters?.dateFrom || undefined,
    date_to: filters?.dateTo || undefined,
  };
  return apiClient.get<AttendanceSummary>("/attendance/analytics", { params }).then((res) => res.data);
}
