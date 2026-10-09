import { apiClient } from "./client";

const BASE = "/front-office";

export type EnquiryStatus = "new" | "follow_up" | "converted" | "closed";
export type EnquirySource =
  | "walk_in"
  | "phone"
  | "facebook"
  | "instagram"
  | "referral"
  | "website"
  | "newspaper"
  | "banner"
  | "other";

export const ENQUIRY_SOURCES: { value: EnquirySource; label: string }[] = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "newspaper", label: "Newspaper" },
  { value: "banner", label: "Banner / Flex" },
  { value: "other", label: "Other" },
];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  follow_up: "Follow-up",
  converted: "Converted",
  closed: "Closed",
};

export interface Enquiry {
  id: string;
  student_name: string;
  parent_name: string | null;
  phone: string | null;
  email: string | null;
  class_grade_id: string | null;
  class_interested: string | null;
  source: EnquirySource;
  enquiry_date: string;
  follow_up_date: string | null;
  status: EnquiryStatus;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
}

export type EnquiryPayload = Partial<Omit<Enquiry, "id" | "created_at">> & { student_name?: string };

export interface EnquirySummary {
  total: number;
  new: number;
  follow_up: number;
  converted: number;
  closed: number;
  due_follow_ups_today: number;
}

export interface FollowUp {
  id: string;
  enquiry_id: string;
  follow_up_date: string;
  note: string;
  next_follow_up_date: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

export interface EnquiryConversionPrefill {
  enquiry_id: string;
  full_name: string;
  guardian_name: string | null;
  email: string | null;
  phone: string | null;
  class_grade_id: string | null;
  class_interested: string | null;
  admission_detail: Record<string, string | null>;
}

export function listEnquiries(params?: { status?: string; q?: string; source?: string }) {
  return apiClient
    .get<Enquiry[]>(`${BASE}/enquiries`, {
      params: { status: params?.status || undefined, q: params?.q || undefined, source: params?.source || undefined },
    })
    .then((r) => r.data);
}
export function getEnquirySummary() {
  return apiClient.get<EnquirySummary>(`${BASE}/enquiries/summary`).then((r) => r.data);
}
export function createEnquiry(payload: EnquiryPayload) {
  return apiClient.post<Enquiry>(`${BASE}/enquiries`, payload).then((r) => r.data);
}
export function updateEnquiry(id: string, payload: EnquiryPayload) {
  return apiClient.patch<Enquiry>(`${BASE}/enquiries/${id}`, payload).then((r) => r.data);
}
export function deleteEnquiry(id: string) {
  return apiClient.delete(`${BASE}/enquiries/${id}`);
}
export function listFollowUps(id: string) {
  return apiClient.get<FollowUp[]>(`${BASE}/enquiries/${id}/follow-ups`).then((r) => r.data);
}
export function addFollowUp(
  id: string,
  payload: { note: string; follow_up_date?: string; next_follow_up_date?: string; status?: EnquiryStatus },
) {
  return apiClient.post<FollowUp>(`${BASE}/enquiries/${id}/follow-ups`, payload).then((r) => r.data);
}
export function convertEnquiry(id: string) {
  return apiClient.post<EnquiryConversionPrefill>(`${BASE}/enquiries/${id}/convert`).then((r) => r.data);
}

// ---------- Visitors ----------
export interface Visitor {
  id: string;
  visitor_name: string;
  phone: string | null;
  cnic: string | null;
  purpose: string;
  person_to_meet: string | null;
  number_of_persons: number;
  in_time: string;
  out_time: string | null;
  notes: string | null;
}
export type VisitorPayload = Partial<Omit<Visitor, "id">>;

export function listVisitors(params?: { date?: string; q?: string; inside_only?: boolean }) {
  return apiClient
    .get<Visitor[]>(`${BASE}/visitors`, {
      params: { date: params?.date || undefined, q: params?.q || undefined, inside_only: params?.inside_only || undefined },
    })
    .then((r) => r.data);
}
export function createVisitor(payload: VisitorPayload) {
  return apiClient.post<Visitor>(`${BASE}/visitors`, payload).then((r) => r.data);
}
export function checkOutVisitor(id: string) {
  return apiClient.post<Visitor>(`${BASE}/visitors/${id}/check-out`, {}).then((r) => r.data);
}
export function deleteVisitor(id: string) {
  return apiClient.delete(`${BASE}/visitors/${id}`);
}

// ---------- Complaints ----------
export type ComplaintStatus = "open" | "in_progress" | "resolved";
export type ComplainantType = "parent" | "student" | "staff" | "other";
export interface Complaint {
  id: string;
  complainant_type: ComplainantType;
  complainant_name: string;
  phone: string | null;
  complaint_type: string;
  description: string;
  complaint_date: string;
  assigned_to: string | null;
  action_taken: string | null;
  status: ComplaintStatus;
}
export type ComplaintPayload = Partial<Omit<Complaint, "id">>;

export function listComplaints(params?: { status?: string; q?: string }) {
  return apiClient
    .get<Complaint[]>(`${BASE}/complaints`, { params: { status: params?.status || undefined, q: params?.q || undefined } })
    .then((r) => r.data);
}
export function createComplaint(payload: ComplaintPayload) {
  return apiClient.post<Complaint>(`${BASE}/complaints`, payload).then((r) => r.data);
}
export function updateComplaint(id: string, payload: ComplaintPayload) {
  return apiClient.patch<Complaint>(`${BASE}/complaints/${id}`, payload).then((r) => r.data);
}
export function deleteComplaint(id: string) {
  return apiClient.delete(`${BASE}/complaints/${id}`);
}

// ---------- Postal ----------
export type PostalType = "received" | "dispatched";
export interface PostalRecord {
  id: string;
  record_type: PostalType;
  title: string;
  reference_no: string | null;
  from_title: string | null;
  to_title: string | null;
  record_date: string;
  notes: string | null;
}
export type PostalPayload = Partial<Omit<PostalRecord, "id">>;

export function listPostal(params?: { type?: string; q?: string }) {
  return apiClient
    .get<PostalRecord[]>(`${BASE}/postal`, { params: { type: params?.type || undefined, q: params?.q || undefined } })
    .then((r) => r.data);
}
export function createPostal(payload: PostalPayload) {
  return apiClient.post<PostalRecord>(`${BASE}/postal`, payload).then((r) => r.data);
}
export function deletePostal(id: string) {
  return apiClient.delete(`${BASE}/postal/${id}`);
}

// ---------- Gate passes ----------
export interface GatePass {
  id: string;
  pass_number: number;
  student_id: string;
  student_name: string;
  admission_number: string | null;
  class_name: string | null;
  section_name: string | null;
  reason: string;
  guardian_name: string;
  guardian_relation: string | null;
  guardian_cnic: string | null;
  guardian_phone: string | null;
  out_time: string;
  approved_by: string | null;
}
export interface StudentLookup {
  student_id: string;
  full_name: string;
  admission_number: string | null;
  class_name: string | null;
  section_name: string | null;
  guardian_name: string | null;
}
export interface GatePassPayload {
  student_id?: string;
  admission_number?: string;
  reason: string;
  guardian_name: string;
  guardian_relation?: string;
  guardian_cnic?: string;
  guardian_phone?: string;
  out_time?: string;
  approved_by?: string;
}

export function lookupStudentByAdmission(admissionNumber: string) {
  return apiClient
    .get<StudentLookup>(`${BASE}/gate-passes/student-lookup`, { params: { admission_number: admissionNumber } })
    .then((r) => r.data);
}
export function listGatePasses(date?: string) {
  return apiClient.get<GatePass[]>(`${BASE}/gate-passes`, { params: { date: date || undefined } }).then((r) => r.data);
}
export function createGatePass(payload: GatePassPayload) {
  return apiClient.post<GatePass>(`${BASE}/gate-passes`, payload).then((r) => r.data);
}
export function deleteGatePass(id: string) {
  return apiClient.delete(`${BASE}/gate-passes/${id}`);
}
export async function openGatePassPdf(id: string) {
  const response = await apiClient.get(`${BASE}/gate-passes/${id}/pdf`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

// ---------- Phone calls ----------
export type CallType = "incoming" | "outgoing";
export interface PhoneCall {
  id: string;
  caller_name: string;
  phone: string | null;
  purpose: string;
  call_date: string;
  call_type: CallType;
  follow_up_date: string | null;
  duration_minutes: number | null;
  notes: string | null;
}
export type PhoneCallPayload = Partial<Omit<PhoneCall, "id">>;

export function listCalls(params?: { type?: string; q?: string }) {
  return apiClient
    .get<PhoneCall[]>(`${BASE}/calls`, { params: { type: params?.type || undefined, q: params?.q || undefined } })
    .then((r) => r.data);
}
export function createCall(payload: PhoneCallPayload) {
  return apiClient.post<PhoneCall>(`${BASE}/calls`, payload).then((r) => r.data);
}
export function deleteCall(id: string) {
  return apiClient.delete(`${BASE}/calls/${id}`);
}
