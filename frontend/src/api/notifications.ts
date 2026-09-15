import { apiClient } from "./client";

export type NotificationChannel = "whatsapp" | "email";
export type NotificationEvent =
  | "attendance_absent"
  | "payment_verified"
  | "fee_due_reminder"
  | "broadcast"
  | "report_card"
  | "custom_email"
  | "admin_notification";
export type NotificationStatus = "sent" | "failed" | "skipped";

export interface NotificationLog {
  id: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  recipient_user_id: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  provider_message_id: string | null;
  student_id: string | null;
  status: NotificationStatus;
  detail: string | null;
  sent_at: string;
}

export interface SendDueRemindersResult {
  invoices_checked: number;
  notifications_sent: number;
}

export interface SendCustomEmailPayload {
  to_email: string;
  subject: string;
  message: string;
}

export interface SendNotificationPayload {
  student_id: string;
  title: string;
  message: string;
  channel: NotificationChannel;
}

export function listNotificationLogs() {
  return apiClient.get<NotificationLog[]>("/notifications/logs").then((res) => res.data);
}

export function sendFeeDueReminders(daysAhead: number) {
  return apiClient
    .post<SendDueRemindersResult>("/notifications/fee-due-reminders", { days_ahead: daysAhead })
    .then((res) => res.data);
}

export function sendCustomEmail(payload: SendCustomEmailPayload) {
  return apiClient.post<NotificationLog>("/notifications/send-email", payload).then((res) => res.data);
}

export function sendNotification(payload: SendNotificationPayload) {
  return apiClient.post<NotificationLog[]>("/notifications/send", payload).then((res) => res.data);
}
