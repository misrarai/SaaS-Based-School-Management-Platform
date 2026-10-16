import { apiClient } from "./client";

const BASE = "/recruitment";

export type VacancyStatus = "open" | "closed";
export type Stage = "applied" | "shortlisted" | "interview" | "offered" | "hired" | "rejected";
export type InterviewResult = "pending" | "pass" | "fail";

export const STAGES: Stage[] = ["applied", "shortlisted", "interview", "offered", "hired", "rejected"];

export interface Vacancy {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  positions: number;
  posted_date: string;
  status: VacancyStatus;
  application_count: number;
  hired_count: number;
}
export interface Application {
  id: string;
  vacancy_id: string;
  vacancy_title: string | null;
  candidate_name: string;
  email: string | null;
  phone: string | null;
  qualification: string | null;
  experience_years: number | null;
  resume_url: string | null;
  applied_date: string;
  stage: Stage;
  interview_at: string | null;
  interviewer: string | null;
  interview_result: InterviewResult | null;
  interview_feedback: string | null;
  notes: string | null;
}

export const listVacancies = (status?: string) =>
  apiClient.get<Vacancy[]>(`${BASE}/vacancies`, { params: { status: status || undefined } }).then((r) => r.data);
export const createVacancy = (p: { title: string; department?: string; description?: string; positions?: number }) =>
  apiClient.post<Vacancy>(`${BASE}/vacancies`, p).then((r) => r.data);
export const updateVacancy = (id: string, p: Partial<{ title: string; department: string; positions: number; status: VacancyStatus }>) =>
  apiClient.patch<Vacancy>(`${BASE}/vacancies/${id}`, p).then((r) => r.data);

export const listApplications = (params?: { vacancy_id?: string; stage?: string }) =>
  apiClient.get<Application[]>(`${BASE}/applications`, { params: { vacancy_id: params?.vacancy_id || undefined, stage: params?.stage || undefined } }).then((r) => r.data);
export const createApplication = (p: { vacancy_id: string; candidate_name: string; email?: string; phone?: string; qualification?: string; experience_years?: number }) =>
  apiClient.post<Application>(`${BASE}/applications`, p).then((r) => r.data);
export const updateApplication = (id: string, p: Partial<{ stage: Stage; interview_at: string | null; interviewer: string; interview_result: InterviewResult; interview_feedback: string; notes: string }>) =>
  apiClient.patch<Application>(`${BASE}/applications/${id}`, p).then((r) => r.data);
