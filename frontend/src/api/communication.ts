import { apiClient } from "./client";

const BASE = "/communication";

// ---------- Notices ----------
export type NoticeAudience = "all" | "staff" | "students" | "parents" | "classes";
export const NOTICE_AUDIENCE_LABELS: Record<NoticeAudience, string> = {
  all: "Everyone",
  staff: "Staff",
  students: "Students",
  parents: "Parents",
  classes: "Specific classes",
};
export interface Notice {
  id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  class_ids: string[] | null;
  publish_date: string;
  expiry_date: string | null;
  attachment_url: string | null;
  is_pinned: boolean;
  created_at: string;
}
export interface NoticePayload {
  title?: string;
  body?: string;
  audience?: NoticeAudience;
  class_ids?: string[] | null;
  publish_date?: string;
  expiry_date?: string | null;
  attachment_url?: string | null;
  is_pinned?: boolean;
}
export function listNotices(includeInactive = false) {
  return apiClient
    .get<Notice[]>(`${BASE}/notices`, { params: { include_inactive: includeInactive || undefined } })
    .then((r) => r.data);
}
export function createNotice(payload: NoticePayload) {
  return apiClient.post<Notice>(`${BASE}/notices`, payload).then((r) => r.data);
}
export function updateNotice(id: string, payload: NoticePayload) {
  return apiClient.patch<Notice>(`${BASE}/notices/${id}`, payload).then((r) => r.data);
}
export function deleteNotice(id: string) {
  return apiClient.delete(`${BASE}/notices/${id}`);
}

// ---------- Diary ----------
export interface DiaryEntry {
  id: string;
  class_grade_id: string;
  class_name: string | null;
  section_id: string | null;
  section_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  diary_date: string;
  homework: string;
  attachment_url: string | null;
  posted_by_user_id: string;
  posted_by_name: string | null;
}
export interface DiaryPayload {
  class_grade_id: string;
  section_id?: string | null;
  subject_id?: string | null;
  diary_date?: string;
  homework: string;
  attachment_url?: string | null;
}
export interface DiaryFilters {
  class_grade_id?: string;
  section_id?: string;
  subject_id?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  student_id?: string;
  mine?: boolean;
}
export function listDiary(filters?: DiaryFilters) {
  const params = Object.fromEntries(Object.entries(filters ?? {}).filter(([, v]) => v !== undefined && v !== ""));
  return apiClient.get<DiaryEntry[]>(`${BASE}/diary`, { params }).then((r) => r.data);
}
export function createDiary(payload: DiaryPayload) {
  return apiClient.post<DiaryEntry>(`${BASE}/diary`, payload).then((r) => r.data);
}
export function deleteDiary(id: string) {
  return apiClient.delete(`${BASE}/diary/${id}`);
}

// ---------- Messages ----------
export interface Contact {
  user_id: string;
  full_name: string;
  role: string;
  email: string;
}
export interface Participant {
  user_id: string;
  full_name: string;
  role: string;
}
export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_user_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
}
export interface Thread {
  id: string;
  subject: string;
  created_by_user_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  participants: Participant[];
}
export interface ThreadDetail extends Thread {
  messages: ChatMessage[];
}
export function listContacts(params?: { role?: string; q?: string }) {
  return apiClient
    .get<Contact[]>(`${BASE}/messages/contacts`, { params: { role: params?.role || undefined, q: params?.q || undefined } })
    .then((r) => r.data);
}
export function listThreads() {
  return apiClient.get<Thread[]>(`${BASE}/messages/threads`).then((r) => r.data);
}
export function getThread(id: string) {
  return apiClient.get<ThreadDetail>(`${BASE}/messages/threads/${id}`).then((r) => r.data);
}
export function createThread(payload: { subject: string; participant_user_ids: string[]; body: string }) {
  return apiClient.post<ThreadDetail>(`${BASE}/messages/threads`, payload).then((r) => r.data);
}
export function postMessage(threadId: string, body: string) {
  return apiClient.post<ThreadDetail>(`${BASE}/messages/threads/${threadId}/messages`, { body }).then((r) => r.data);
}
export function getUnreadCount() {
  return apiClient.get<{ unread: number }>(`${BASE}/messages/unread-count`).then((r) => r.data.unread);
}

// ---------- Events ----------
export type EventType = "holiday" | "event" | "exam" | "meeting";
export type EventAudience = "all" | "staff" | "students" | "parents";
export interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  event_type: EventType;
  audience: EventAudience;
}
export interface EventPayload {
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  event_type: EventType;
  audience: EventAudience;
}
export function listEvents(year: number, month: number) {
  return apiClient.get<SchoolEvent[]>(`${BASE}/events`, { params: { year, month } }).then((r) => r.data);
}
export function createEvent(payload: EventPayload) {
  return apiClient.post<SchoolEvent>(`${BASE}/events`, payload).then((r) => r.data);
}
export function deleteEvent(id: string) {
  return apiClient.delete(`${BASE}/events/${id}`);
}

// ---------- To-do ----------
export interface Todo {
  id: string;
  title: string;
  due_date: string | null;
  is_done: boolean;
  created_at: string;
}
export function listTodos(includeDone = true) {
  return apiClient.get<Todo[]>(`${BASE}/todos`, { params: { include_done: includeDone } }).then((r) => r.data);
}
export function createTodo(payload: { title: string; due_date?: string }) {
  return apiClient.post<Todo>(`${BASE}/todos`, payload).then((r) => r.data);
}
export function updateTodo(id: string, payload: { title?: string; due_date?: string | null; is_done?: boolean }) {
  return apiClient.patch<Todo>(`${BASE}/todos/${id}`, payload).then((r) => r.data);
}
export function deleteTodo(id: string) {
  return apiClient.delete(`${BASE}/todos/${id}`);
}

// ---------- SMS ----------
export interface SmsSendPayload {
  audience: "all_parents" | "class_parents";
  class_grade_id?: string;
  section_id?: string;
  message: string;
  email_fallback?: boolean;
}
export interface SmsSendResult {
  recipients: number;
  sms_sent: number;
  sms_skipped: number;
  sms_failed: number;
  email_sent: number;
  email_skipped: number;
}
export interface CommunicationLog {
  id: string;
  channel: string;
  audience: string;
  recipient_user_id: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  message: string;
  status: "sent" | "failed" | "skipped";
  detail: string | null;
  created_at: string;
}
export function sendSms(payload: SmsSendPayload) {
  return apiClient.post<SmsSendResult>(`${BASE}/sms/send`, payload).then((r) => r.data);
}
export function listSmsLogs() {
  return apiClient.get<CommunicationLog[]>(`${BASE}/sms/logs`).then((r) => r.data);
}
