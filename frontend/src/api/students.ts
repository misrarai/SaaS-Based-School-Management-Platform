import { apiClient } from "./client";

export interface StudentAdmissionDetail {
  discount_amount: number | null;
  photo_url: string | null;

  father_name: string | null;
  father_cnic: string | null;
  father_mobile: string | null;
  father_qualification: string | null;
  father_occupation: string | null;
  guardian_mobile: string | null;
  whatsapp_number: string | null;
  category: string | null;
  student_cnic: string | null;
  caste: string | null;
  gender: string | null;
  current_address: string | null;

  mother_name: string | null;
  mother_cnic: string | null;
  mother_mobile: string | null;
  mother_qualification: string | null;

  guardian_relation: string | null;

  emergency_relation: string | null;
  emergency_contact_name: string | null;
  emergency_phone: string | null;
  emergency_mobile: string | null;
  emergency_address: string | null;

  utm_source: string | null;
  admission_form_number: string | null;
  register_serial_no: string | null;
  previous_class: string | null;
  previous_school: string | null;
  region: string | null;
  blood_group: string | null;
  student_mobile: string | null;
  birth_place: string | null;
  religion: string | null;
  nationality: string | null;
}

export type StudentAdmissionDetailPayload = Partial<StudentAdmissionDetail>;

export interface Student {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  class_grade_id: string | null;
  section_id: string | null;
  family_id: string | null;
  admission_number: string | null;
  roll_number: string | null;
  admission_date: string | null;
  date_of_birth: string | null;
  guardian_name: string | null;
  status: string;
  withdrawal_date: string | null;
  withdrawal_reason: string | null;
  admission_detail: StudentAdmissionDetail | null;
}

export interface StudentCreatePayload {
  full_name: string;
  email: string;
  password: string;
  class_grade_id: string;
  section_id?: string;
  family_id?: string;
  roll_number?: string;
  admission_date?: string;
  date_of_birth?: string;
  guardian_name?: string;
  admission_detail?: StudentAdmissionDetailPayload;
}

export interface StudentListFilters {
  classGradeId?: string;
  familyId?: string;
  status?: "active" | "old" | "withdrawn" | "all";
  query?: string;
}

export function listStudents(filters?: StudentListFilters | string) {
  const normalized: StudentListFilters = typeof filters === "string" ? { classGradeId: filters } : filters ?? {};
  const params = {
    class_grade_id: normalized.classGradeId || undefined,
    family_id: normalized.familyId || undefined,
    status: normalized.status || undefined,
    q: normalized.query || undefined,
  };
  return apiClient.get<Student[]>("/students", { params }).then((res) => res.data);
}

export function createStudent(payload: StudentCreatePayload) {
  return apiClient.post<Student>("/students", payload).then((res) => res.data);
}

export function getStudent(studentId: string) {
  return apiClient.get<Student>(`/students/${studentId}`).then((res) => res.data);
}

export function getMyStudentProfile() {
  return apiClient.get<Student>("/students/me").then((res) => res.data);
}

export function withdrawStudent(studentId: string, reason?: string, withdrawalDate?: string) {
  return apiClient
    .post<Student>(`/students/${studentId}/withdraw`, { reason, withdrawal_date: withdrawalDate })
    .then((res) => res.data);
}

export function reactivateStudent(studentId: string) {
  return apiClient.post<Student>(`/students/${studentId}/reactivate`).then((res) => res.data);
}

export function getNextAdmissionNumber() {
  return apiClient
    .get<{ next_admission_number: string }>("/students/next-admission-number")
    .then((res) => res.data.next_admission_number);
}

export interface StudentImportResult {
  created: number;
  failed: { row: number; error: string }[];
}

export function importStudents(file: File, classGradeId: string, sectionId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient
    .post<StudentImportResult>("/students/import", formData, {
      params: { class_grade_id: classGradeId, section_id: sectionId || undefined },
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
}

export async function downloadImportSample() {
  const response = await apiClient.get("/students/import/sample", { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = "student_import_sample.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export interface StudentUpdatePayload {
  full_name?: string;
  class_grade_id?: string | null;
  section_id?: string | null;
  family_id?: string | null;
  roll_number?: string | null;
  status?: string;
  is_active?: boolean;
  admission_detail?: StudentAdmissionDetailPayload;
}

export function updateStudent(studentId: string, payload: StudentUpdatePayload) {
  return apiClient.patch<Student>(`/students/${studentId}`, payload).then((res) => res.data);
}

function fetchPdf(path: string, params?: Record<string, unknown>) {
  return apiClient.get<Blob>(path, { params, responseType: "blob" }).then((res) => res.data);
}

export function fetchIdCardPdf(studentId: string) {
  return fetchPdf(`/students/${studentId}/id-card`);
}

export function fetchCertificatePdf(studentId: string, achievementText?: string) {
  return fetchPdf(`/students/${studentId}/certificate`, { achievement_text: achievementText || undefined });
}

export function fetchReportCardPdf(studentId: string, periodMonth?: number, periodYear?: number) {
  return fetchPdf(`/students/${studentId}/report-card`, { period_month: periodMonth, period_year: periodYear });
}

export interface NotificationLogEntry {
  id: string;
  channel: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: string;
  detail: string | null;
}

export function emailReportCard(
  studentId: string,
  payload: { period_month?: number; period_year?: number; to_email?: string },
) {
  return apiClient
    .post<NotificationLogEntry[]>(`/students/${studentId}/report-card/email`, payload)
    .then((res) => res.data);
}
