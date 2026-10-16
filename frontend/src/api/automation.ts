import { apiClient } from "./client";

const BASE = "/automation";

export type AutomationEvent = "student_absent" | "payment_verified" | "result_published" | "fee_due_reminder";
export type AutomationChannel = "sms" | "email" | "whatsapp";

export const EVENT_LABELS: Record<AutomationEvent, string> = {
  student_absent: "Student marked absent",
  payment_verified: "Fee payment verified",
  result_published: "Exam results published",
  fee_due_reminder: "Fee due reminder",
};

export const EVENT_TOKENS: Record<AutomationEvent, string[]> = {
  student_absent: ["student_name", "date"],
  payment_verified: ["student_name", "amount"],
  result_published: ["student_name", "exam"],
  fee_due_reminder: ["student_name", "amount", "due_date", "invoice"],
};

export interface AutomationRule {
  id: string;
  name: string;
  event: AutomationEvent;
  channel: AutomationChannel;
  subject: string | null;
  message_template: string;
  is_active: boolean;
}
export interface AutomationRulePayload {
  name: string;
  event: AutomationEvent;
  channel: AutomationChannel;
  subject?: string | null;
  message_template: string;
  is_active?: boolean;
}
export interface AutomationRun {
  id: string;
  rule_id: string;
  event: string;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  detail: string | null;
  fired_at: string;
}
export interface AutomationTestResult {
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  detail: string | null;
  preview: string;
}

export const listAutomationRules = () => apiClient.get<AutomationRule[]>(`${BASE}/rules`).then((r) => r.data);
export const createAutomationRule = (p: AutomationRulePayload) => apiClient.post<AutomationRule>(`${BASE}/rules`, p).then((r) => r.data);
export const updateAutomationRule = (id: string, p: Partial<AutomationRulePayload>) => apiClient.patch<AutomationRule>(`${BASE}/rules/${id}`, p).then((r) => r.data);
export const deleteAutomationRule = (id: string) => apiClient.delete(`${BASE}/rules/${id}`);
export const testAutomationRule = (id: string) => apiClient.post<AutomationTestResult>(`${BASE}/rules/${id}/test`).then((r) => r.data);
export const listAutomationRuns = () => apiClient.get<AutomationRun[]>(`${BASE}/runs`).then((r) => r.data);
