import { apiClient } from "./client";

const BASE = "/promotion";

export type OnFail = "repeat" | "graduate";

export interface PromotionRule {
  id: string;
  source_class_id: string;
  source_class_name: string | null;
  target_class_id: string | null;
  target_class_name: string | null;
  pass_mark: number | null;
  on_fail: OnFail;
  is_active: boolean;
}
export interface PromotionCandidate {
  student_id: string;
  full_name: string;
  admission_number: string | null;
  roll_number: string | null;
  section_name: string | null;
}

export const listPromotionRules = () => apiClient.get<PromotionRule[]>(`${BASE}/rules`).then((r) => r.data);
export const createPromotionRule = (p: { source_class_id: string; target_class_id?: string | null; pass_mark?: number | null; on_fail?: OnFail }) =>
  apiClient.post<PromotionRule>(`${BASE}/rules`, p).then((r) => r.data);
export const deletePromotionRule = (id: string) => apiClient.delete(`${BASE}/rules/${id}`);
export const listCandidates = (sourceClassId: string) =>
  apiClient.get<PromotionCandidate[]>(`${BASE}/candidates`, { params: { source_class_id: sourceClassId } }).then((r) => r.data);
export const executePromotion = (p: { source_class_id: string; target_class_id?: string | null; student_ids: string[] }) =>
  apiClient.post<{ promoted: number; graduated: number }>(`${BASE}/execute`, p).then((r) => r.data);
