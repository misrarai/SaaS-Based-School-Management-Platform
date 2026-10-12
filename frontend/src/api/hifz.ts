import { apiClient } from "./client";

const BASE = "/hifz";

export type EnrolmentStatus = "active" | "completed" | "left";
export type HifzGrade = "excellent" | "good" | "fair" | "weak";

export interface Halqa {
  id: string;
  name: string;
  incharge: string | null;
  description: string | null;
  is_active: boolean;
  student_count: number;
}
export interface Enrolment {
  id: string;
  halqa_id: string;
  halqa_name: string | null;
  student_id: string;
  student_name: string | null;
  admission_number: string | null;
  start_date: string;
  current_juz: number;
  current_page: number;
  status: EnrolmentStatus;
  notes: string | null;
  records_count: number;
}
export interface DailyRecord {
  id: string;
  enrolment_id: string;
  record_date: string;
  sabaq: string | null;
  sabqi: string | null;
  manzil: string | null;
  grade: HifzGrade | null;
  mistakes: number | null;
  remarks: string | null;
}

export const listHalqas = () => apiClient.get<Halqa[]>(`${BASE}/halqas`).then((r) => r.data);
export const createHalqa = (p: { name: string; incharge?: string; description?: string }) =>
  apiClient.post<Halqa>(`${BASE}/halqas`, p).then((r) => r.data);
export const updateHalqa = (id: string, p: Partial<{ name: string; incharge: string; description: string; is_active: boolean }>) =>
  apiClient.patch<Halqa>(`${BASE}/halqas/${id}`, p).then((r) => r.data);

export const listEnrolments = (params?: { halqa_id?: string; status?: string }) =>
  apiClient.get<Enrolment[]>(`${BASE}/enrolments`, { params: { halqa_id: params?.halqa_id || undefined, status: params?.status || undefined } }).then((r) => r.data);
export const createEnrolment = (p: { halqa_id: string; student_id: string; current_juz?: number; current_page?: number }) =>
  apiClient.post<Enrolment>(`${BASE}/enrolments`, p).then((r) => r.data);
export const updateEnrolment = (id: string, p: Partial<{ halqa_id: string; current_juz: number; current_page: number; status: EnrolmentStatus; notes: string }>) =>
  apiClient.patch<Enrolment>(`${BASE}/enrolments/${id}`, p).then((r) => r.data);

export const listRecords = (enrolmentId: string) =>
  apiClient.get<DailyRecord[]>(`${BASE}/enrolments/${enrolmentId}/records`).then((r) => r.data);
export const addRecord = (enrolmentId: string, p: Partial<Omit<DailyRecord, "id" | "enrolment_id">>) =>
  apiClient.post<DailyRecord>(`${BASE}/enrolments/${enrolmentId}/records`, p).then((r) => r.data);

// ---------- Donors / Donations / Sponsorships ----------
export interface Donor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  total_donated: number;
  active_sponsorships: number;
}
export interface Donation {
  id: string;
  donor_id: string;
  donor_name: string | null;
  amount: number;
  donation_date: string;
  purpose: string | null;
  payment_method: string | null;
  notes: string | null;
}
export interface Sponsorship {
  id: string;
  donor_id: string;
  donor_name: string | null;
  student_id: string;
  student_name: string | null;
  monthly_amount: number;
  start_date: string;
  status: "active" | "ended";
  notes: string | null;
}

export const listDonors = () => apiClient.get<Donor[]>(`${BASE}/donors`).then((r) => r.data);
export const createDonor = (p: { name: string; phone?: string; email?: string; address?: string }) =>
  apiClient.post<Donor>(`${BASE}/donors`, p).then((r) => r.data);
export const listDonations = (donorId?: string) =>
  apiClient.get<Donation[]>(`${BASE}/donations`, { params: { donor_id: donorId || undefined } }).then((r) => r.data);
export const createDonation = (p: { donor_id: string; amount: number; purpose?: string; payment_method?: string }) =>
  apiClient.post<Donation>(`${BASE}/donations`, p).then((r) => r.data);
export const listSponsorships = (status?: string) =>
  apiClient.get<Sponsorship[]>(`${BASE}/sponsorships`, { params: { status: status || undefined } }).then((r) => r.data);
export const createSponsorship = (p: { donor_id: string; student_id: string; monthly_amount: number }) =>
  apiClient.post<Sponsorship>(`${BASE}/sponsorships`, p).then((r) => r.data);
export const updateSponsorship = (id: string, p: { status?: "active" | "ended"; monthly_amount?: number }) =>
  apiClient.patch<Sponsorship>(`${BASE}/sponsorships/${id}`, p).then((r) => r.data);
