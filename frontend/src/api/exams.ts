import { apiClient } from "./client";

// ---------- Grading schemes ----------
export interface GradingBand {
  id?: string;
  min_percent: number;
  max_percent: number;
  grade: string;
  gpa: number | null;
  remarks: string | null;
}

export interface GradingScheme {
  id: string;
  name: string;
  is_default: boolean;
  bands: GradingBand[];
}

export interface GradingSchemePayload {
  name: string;
  is_default: boolean;
  bands: GradingBand[];
}

export function listGradingSchemes() {
  return apiClient.get<GradingScheme[]>("/exams/grading-schemes").then((res) => res.data);
}

export function createGradingScheme(payload: GradingSchemePayload) {
  return apiClient.post<GradingScheme>("/exams/grading-schemes", payload).then((res) => res.data);
}

export function updateGradingScheme(id: string, payload: Partial<GradingSchemePayload>) {
  return apiClient.put<GradingScheme>(`/exams/grading-schemes/${id}`, payload).then((res) => res.data);
}

export function deleteGradingScheme(id: string) {
  return apiClient.delete(`/exams/grading-schemes/${id}`);
}

export function seedDefaultGradingScheme() {
  return apiClient.post<GradingScheme>("/exams/grading-schemes/default").then((res) => res.data);
}

// ---------- Exams ----------
export type ExamStatus = "draft" | "published";

export interface Exam {
  id: string;
  name: string;
  academic_year: string | null;
  academic_year_id: string | null;
  start_date: string | null;
  end_date: string | null;
  grading_scheme_id: string | null;
  grading_scheme_name: string | null;
  status: ExamStatus;
  results_published: boolean;
  description: string | null;
  classes: { class_grade_id: string; class_name: string }[];
}

export interface ExamPayload {
  name: string;
  academic_year?: string | null;
  academic_year_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  grading_scheme_id?: string | null;
  description?: string | null;
  class_grade_ids: string[];
  status?: ExamStatus;
}

export function listExams() {
  return apiClient.get<Exam[]>("/exams").then((res) => res.data);
}

export function getExam(examId: string) {
  return apiClient.get<Exam>(`/exams/${examId}`).then((res) => res.data);
}

export function createExam(payload: ExamPayload) {
  return apiClient.post<Exam>("/exams", payload).then((res) => res.data);
}

export function updateExam(examId: string, payload: Partial<ExamPayload>) {
  return apiClient.patch<Exam>(`/exams/${examId}`, payload).then((res) => res.data);
}

export function deleteExam(examId: string) {
  return apiClient.delete(`/exams/${examId}`);
}

export function publishResults(examId: string, published: boolean) {
  return apiClient.post<Exam>(`/exams/${examId}/publish-results`, { published }).then((res) => res.data);
}

// ---------- Datesheet ----------
export interface DatesheetEntry {
  id: string;
  class_grade_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  exam_date: string | null;
  start_time: string | null;
  end_time: string | null;
  total_marks: number;
  passing_marks: number;
  room: string | null;
}

export interface DatesheetEntryInput {
  subject_id: string;
  exam_date: string | null;
  start_time: string | null;
  end_time: string | null;
  total_marks: number;
  passing_marks: number;
  room: string | null;
}

export function getDatesheet(examId: string, params: { class_grade_id?: string; student_id?: string } = {}) {
  return apiClient.get<DatesheetEntry[]>(`/exams/${examId}/datesheet`, { params }).then((res) => res.data);
}

export function saveDatesheet(examId: string, classGradeId: string, entries: DatesheetEntryInput[]) {
  return apiClient
    .put<DatesheetEntry[]>(`/exams/${examId}/datesheet`, { class_grade_id: classGradeId, entries })
    .then((res) => res.data);
}

// ---------- Marks ----------
export interface MarkRow {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  admission_number: string | null;
  section_id: string | null;
  obtained_marks: number | null;
  is_absent: boolean;
  remarks: string | null;
}

export interface MarksSheet {
  exam_id: string;
  class_grade_id: string;
  section_id: string | null;
  subject_id: string;
  subject_name: string;
  total_marks: number;
  passing_marks: number;
  locked: boolean;
  rows: MarkRow[];
}

export interface MarksQuery {
  class_grade_id: string;
  section_id?: string | null;
  subject_id: string;
}

export interface MarkEntryInput {
  student_id: string;
  obtained_marks: number | null;
  is_absent: boolean;
  remarks: string | null;
}

export function getMarksSheet(examId: string, q: MarksQuery) {
  return apiClient
    .get<MarksSheet>(`/exams/${examId}/marks`, { params: { ...q, section_id: q.section_id || undefined } })
    .then((res) => res.data);
}

export function saveMarks(examId: string, q: MarksQuery, entries: MarkEntryInput[]) {
  return apiClient
    .put<MarksSheet>(`/exams/${examId}/marks`, { ...q, section_id: q.section_id || null, entries })
    .then((res) => res.data);
}

export interface TeacherSubject {
  class_grade_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  subject_id: string;
  subject_name: string;
}

export function listMyTeachingSubjects() {
  return apiClient.get<TeacherSubject[]>("/exams/teacher/my-subjects").then((res) => res.data);
}

// ---------- Results ----------
export interface SubjectHeader {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  total_marks: number;
  passing_marks: number;
}

export interface SubjectResult {
  subject_id: string;
  subject_name: string;
  total_marks: number;
  passing_marks: number;
  obtained_marks: number | null;
  is_absent: boolean;
  grade: string | null;
  passed: boolean;
  remarks: string | null;
}

export interface StudentResult {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  admission_number: string | null;
  section_id: string | null;
  section_name: string | null;
  subjects: SubjectResult[];
  total_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string | null;
  gpa: number | null;
  grade_remarks: string | null;
  passed: boolean;
  position: number | null;
  section_position: number | null;
  remarks: string | null;
}

export interface Tabulation {
  exam_id: string;
  exam_name: string;
  class_grade_id: string;
  class_name: string;
  section_id: string | null;
  results_published: boolean;
  subjects: SubjectHeader[];
  rows: StudentResult[];
}

export interface StudentExamResult {
  exam_id: string;
  exam_name: string;
  academic_year: string | null;
  start_date: string | null;
  end_date: string | null;
  class_name: string;
  class_strength: number;
  result: StudentResult;
}

export interface MyExam {
  exam_id: string;
  student_id: string;
  exam_name: string;
  academic_year: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ExamStatus;
  results_published: boolean;
  percentage: number | null;
  grade: string | null;
  position: number | null;
  passed: boolean | null;
}

export function getTabulation(examId: string, classGradeId: string, sectionId?: string | null) {
  return apiClient
    .get<Tabulation>(`/exams/${examId}/results`, {
      params: { class_grade_id: classGradeId, section_id: sectionId || undefined },
    })
    .then((res) => res.data);
}

export function getStudentResult(examId: string, studentId: string) {
  return apiClient.get<StudentExamResult>(`/exams/${examId}/students/${studentId}/result`).then((res) => res.data);
}

export function saveStudentRemarks(examId: string, studentId: string, remarks: string) {
  return apiClient.put(`/exams/${examId}/students/${studentId}/remarks`, { remarks });
}

export function listMyExams(studentId?: string) {
  return apiClient
    .get<MyExam[]>("/exams/my", { params: { student_id: studentId || undefined } })
    .then((res) => res.data);
}

// ---------- PDFs ----------
async function openPdf(url: string, params: Record<string, string | undefined>, filename: string) {
  const response = await apiClient.get(url, { params, responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}

export function downloadDatesheetPdf(examId: string, params: { class_grade_id?: string; student_id?: string }) {
  return openPdf(`/exams/${examId}/datesheet/pdf`, params, "datesheet.pdf");
}

export function downloadTabulationPdf(examId: string, classGradeId: string, sectionId?: string | null) {
  return openPdf(
    `/exams/${examId}/results/pdf`,
    { class_grade_id: classGradeId, section_id: sectionId || undefined },
    "tabulation-sheet.pdf",
  );
}

export function downloadResultCard(examId: string, studentId: string) {
  return openPdf(`/exams/${examId}/students/${studentId}/result-card`, {}, "result-card.pdf");
}
