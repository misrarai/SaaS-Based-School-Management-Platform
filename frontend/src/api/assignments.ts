import { apiClient } from "./client";

export interface Assignment {
  id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  instructions_file_url: string | null;
  due_date: string;
  max_marks: number | null;
}

export interface AssignmentCreatePayload {
  section_id: string;
  subject_id: string;
  title: string;
  description?: string;
  instructions_file_url?: string;
  due_date: string;
  max_marks?: number;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_file_url: string | null;
  submitted_at: string | null;
  is_late: boolean;
  marks_obtained: number | null;
  teacher_feedback: string | null;
  graded_by_user_id: string | null;
  graded_at: string | null;
}

export interface GradebookEntry {
  assignment_id: string;
  assignment_title: string;
  subject_id: string;
  max_marks: number | null;
  marks_obtained: number | null;
  due_date: string;
  graded_at: string | null;
  teacher_feedback?: string | null;
}

export function listAssignments(filters?: { sectionId?: string; subjectId?: string }) {
  const params = { section_id: filters?.sectionId || undefined, subject_id: filters?.subjectId || undefined };
  return apiClient.get<Assignment[]>("/assignments", { params }).then((res) => res.data);
}

export function createAssignment(payload: AssignmentCreatePayload) {
  return apiClient.post<Assignment>("/assignments", payload).then((res) => res.data);
}

export function listSubmissions(assignmentId: string) {
  return apiClient.get<Submission[]>(`/assignments/${assignmentId}/submissions`).then((res) => res.data);
}

export function submitAssignment(assignmentId: string, fileUrl: string) {
  return apiClient
    .post<Submission>(`/assignments/${assignmentId}/submit`, { file_url: fileUrl })
    .then((res) => res.data);
}

export function gradeSubmission(submissionId: string, marksObtained: number, teacherFeedback?: string) {
  return apiClient
    .post<Submission>(`/assignments/submissions/${submissionId}/grade`, {
      marks_obtained: marksObtained,
      teacher_feedback: teacherFeedback,
    })
    .then((res) => res.data);
}

export function getGradebook(studentId?: string) {
  return apiClient
    .get<GradebookEntry[]>("/assignments/gradebook", { params: { student_id: studentId || undefined } })
    .then((res) => res.data);
}

export interface SubjectPerformanceEntry {
  subject_id: string;
  subject_name: string;
  average_percent: number | null;
}

export function getSubjectPerformance(studentId?: string) {
  return apiClient
    .get<SubjectPerformanceEntry[]>("/assignments/performance", { params: { student_id: studentId || undefined } })
    .then((res) => res.data);
}
