import { apiClient } from "./client";

export type SessionStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface ClassSchedule {
  id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number; // Monday=0 .. Sunday=6
  start_time: string;
  end_time: string;
  default_meeting_url: string | null;
  is_active: boolean;
}

export interface ClassScheduleCreatePayload {
  section_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  default_meeting_url?: string;
}

export type MeetingStatus = "not_created" | "created" | "failed" | "cancelled";

export interface ClassSession {
  id: string;
  class_schedule_id: string | null;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  description: string | null;
  meeting_url: string | null;
  status: SessionStatus;
  actual_start_at: string | null;
  actual_end_at: string | null;
  cancellation_reason: string | null;
  google_event_id: string | null;
  meet_link: string | null;
  google_calendar_id: string | null;
  meeting_status: MeetingStatus;
}

export interface OnlineClassCreatePayload {
  section_id: string;
  subject_id: string;
  teacher_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  title: string;
  description?: string;
  notify_channel?: "email" | "whatsapp";
}

export interface SessionListFilters {
  teacherId?: string;
  sectionId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function listTemplates() {
  return apiClient.get<ClassSchedule[]>("/schedule/templates").then((res) => res.data);
}

export function createTemplate(payload: ClassScheduleCreatePayload) {
  return apiClient.post<ClassSchedule>("/schedule/templates", payload).then((res) => res.data);
}

export function setTemplateActive(scheduleId: string, isActive: boolean) {
  return apiClient
    .patch<ClassSchedule>(`/schedule/templates/${scheduleId}`, { is_active: isActive })
    .then((res) => res.data);
}

export function generateSessions(startDate: string, endDate: string) {
  return apiClient
    .post<ClassSession[]>("/schedule/sessions/generate", { start_date: startDate, end_date: endDate })
    .then((res) => res.data);
}

export function listSessions(filters?: SessionListFilters) {
  const params = {
    teacher_id: filters?.teacherId || undefined,
    section_id: filters?.sectionId || undefined,
    date_from: filters?.dateFrom || undefined,
    date_to: filters?.dateTo || undefined,
  };
  return apiClient.get<ClassSession[]>("/schedule/sessions", { params }).then((res) => res.data);
}

export function startSession(sessionId: string) {
  return apiClient.post<ClassSession>(`/schedule/sessions/${sessionId}/start`).then((res) => res.data);
}

export function endSession(sessionId: string) {
  return apiClient.post<ClassSession>(`/schedule/sessions/${sessionId}/end`).then((res) => res.data);
}

/** Creates one dated online class and, if Google Calendar is connected, its Google Meet link. */
export function createOnlineClass(payload: OnlineClassCreatePayload) {
  return apiClient.post<ClassSession>("/schedule/sessions", payload).then((res) => res.data);
}

/** Idempotent: a no-op if the session already has a Meet link, unless force is passed. */
export function generateMeetLink(sessionId: string, force = false) {
  return apiClient
    .post<ClassSession>(`/schedule/sessions/${sessionId}/generate-meet`, undefined, { params: { force } })
    .then((res) => res.data);
}

export function deleteSession(sessionId: string) {
  return apiClient.delete(`/schedule/sessions/${sessionId}`);
}
