import { apiClient } from "./client";

export type PayoutRateType = "per_session" | "revenue_share_percent";
export type PayoutStatus = "draft" | "approved" | "paid";

export interface PayoutRate {
  id: string;
  teacher_id: string;
  subject_id: string | null;
  rate_type: PayoutRateType;
  rate_value: number;
  effective_from: string;
  is_active: boolean;
}

export interface PayoutRateCreatePayload {
  teacher_id: string;
  subject_id?: string;
  rate_type: PayoutRateType;
  rate_value: number;
  effective_from: string;
}

export interface Payout {
  id: string;
  teacher_id: string;
  period_month: number;
  period_year: number;
  sessions_delivered: number;
  calculated_amount: number;
  status: PayoutStatus;
  approved_by_user_id: string | null;
  paid_at: string | null;
  notes: string | null;
}

export function listPayoutRates(teacherId?: string) {
  return apiClient
    .get<PayoutRate[]>("/payouts/rates", { params: { teacher_id: teacherId || undefined } })
    .then((res) => res.data);
}

export function createPayoutRate(payload: PayoutRateCreatePayload) {
  return apiClient.post<PayoutRate>("/payouts/rates", payload).then((res) => res.data);
}

export function generatePayout(teacherId: string, periodMonth: number, periodYear: number) {
  return apiClient
    .post<Payout>("/payouts/generate", { teacher_id: teacherId, period_month: periodMonth, period_year: periodYear })
    .then((res) => res.data);
}

export function bulkGeneratePayouts(periodMonth: number, periodYear: number) {
  return apiClient
    .post<Payout[]>("/payouts/generate-all", { period_month: periodMonth, period_year: periodYear })
    .then((res) => res.data);
}

export function listPayouts() {
  return apiClient.get<Payout[]>("/payouts").then((res) => res.data);
}

export function approvePayout(payoutId: string) {
  return apiClient.post<Payout>(`/payouts/${payoutId}/approve`).then((res) => res.data);
}

export function markPayoutPaid(payoutId: string) {
  return apiClient.post<Payout>(`/payouts/${payoutId}/mark-paid`).then((res) => res.data);
}
