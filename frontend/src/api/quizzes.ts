import { apiClient } from "./client";

export type QuestionType = "mcq_single" | "true_false" | "short_answer";
export type AttemptStatus = "in_progress" | "submitted" | "graded";

export interface Quiz {
  id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  chapter_id: string | null;
  title: string;
  description: string | null;
  time_limit_minutes: number | null;
  due_date: string | null;
  is_published: boolean;
}

export interface OptionCreatePayload {
  option_text: string;
  is_correct: boolean;
}

export interface QuestionCreatePayload {
  question_text: string;
  question_type: QuestionType;
  marks: number;
  options: OptionCreatePayload[];
}

export interface QuizCreatePayload {
  section_id: string;
  subject_id: string;
  chapter_id?: string;
  title: string;
  description?: string;
  time_limit_minutes?: number;
  due_date?: string;
  questions: QuestionCreatePayload[];
}

export interface QuizOption {
  id: string;
  option_text: string;
  order_index: number;
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  order_index: number;
  marks: number;
  options: QuizOption[];
}

export interface QuizTake {
  id: string;
  title: string;
  description: string | null;
  time_limit_minutes: number | null;
  due_date: string | null;
  questions: QuizQuestion[];
}

export interface AnswerPayload {
  question_id: string;
  selected_option_id?: string | null;
  answer_text?: string | null;
}

export interface Attempt {
  id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number;
  status: AttemptStatus;
  percentage: number | null;
  grade: string | null;
}

export interface ReviewOption extends QuizOption {
  is_correct: boolean;
}

export interface ReviewQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  order_index: number;
  marks: number;
  options: ReviewOption[];
  selected_option_id: string | null;
  answer_text: string | null;
  marks_awarded: number | null;
  is_correct: boolean | null;
}

export interface AttemptReview {
  id: string;
  quiz_id: string;
  score: number | null;
  max_score: number;
  status: AttemptStatus;
  questions: ReviewQuestion[];
  percentage: number | null;
  grade: string | null;
}

export interface ResultEntry {
  attempt_id: string;
  student_id: string;
  student_name: string;
  score: number | null;
  max_score: number;
  status: AttemptStatus;
  submitted_at: string | null;
  needs_grading: boolean;
  percentage: number | null;
  grade: string | null;
}

export function listQuizzes(filters?: { sectionId?: string; subjectId?: string; chapterId?: string }) {
  const params = {
    section_id: filters?.sectionId || undefined,
    subject_id: filters?.subjectId || undefined,
    chapter_id: filters?.chapterId || undefined,
  };
  return apiClient.get<Quiz[]>("/quizzes", { params }).then((res) => res.data);
}

export function createQuiz(payload: QuizCreatePayload) {
  return apiClient.post<Quiz>("/quizzes", payload).then((res) => res.data);
}

export function setQuizPublished(quizId: string, isPublished: boolean) {
  return apiClient.patch<Quiz>(`/quizzes/${quizId}`, { is_published: isPublished }).then((res) => res.data);
}

export function getQuizForTaking(quizId: string) {
  return apiClient.get<QuizTake>(`/quizzes/${quizId}/take`).then((res) => res.data);
}

export function startAttempt(quizId: string) {
  return apiClient.post<Attempt>(`/quizzes/${quizId}/attempts/start`).then((res) => res.data);
}

export function submitAttempt(attemptId: string, answers: AnswerPayload[]) {
  return apiClient.post<Attempt>(`/quizzes/attempts/${attemptId}/submit`, { answers }).then((res) => res.data);
}

export function getMyAttempt(quizId: string) {
  return apiClient.get<AttemptReview>(`/quizzes/${quizId}/my-attempt`).then((res) => res.data);
}

export function getResults(quizId: string) {
  return apiClient.get<ResultEntry[]>(`/quizzes/${quizId}/results`).then((res) => res.data);
}

export function getAttemptReview(attemptId: string) {
  return apiClient.get<AttemptReview>(`/quizzes/attempts/${attemptId}/review`).then((res) => res.data);
}

export function gradeAttempt(attemptId: string, answers: { question_id: string; marks_awarded: number }[]) {
  return apiClient.post<Attempt>(`/quizzes/attempts/${attemptId}/grade`, { answers }).then((res) => res.data);
}
