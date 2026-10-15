import { apiClient } from "./client";

export interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  is_active: boolean;
  employee_code: string | null;
  hire_date: string | null;
  qualification: string | null;
}

export interface TeacherCreatePayload {
  full_name: string;
  email: string;
  password: string;
  phone_number?: string;
  employee_code?: string;
  hire_date?: string;
  qualification?: string;
}

export interface TeacherUpdatePayload {
  full_name?: string;
  phone_number?: string | null;
  qualification?: string | null;
  employee_code?: string | null;
  hire_date?: string | null;
  is_active?: boolean;
}

export function listTeachers(query?: string, isActive?: boolean) {
  return apiClient
    .get<Teacher[]>("/teachers", {
      params: { q: query || undefined, is_active: isActive },
    })
    .then((res) => res.data);
}

export function getTeacher(teacherId: string) {
  return apiClient.get<Teacher>(`/teachers/${teacherId}`).then((res) => res.data);
}

export function createTeacher(payload: TeacherCreatePayload) {
  return apiClient.post<Teacher>("/teachers", payload).then((res) => res.data);
}

export function setTeacherActive(teacherId: string, isActive: boolean) {
  return apiClient.patch<Teacher>(`/teachers/${teacherId}`, { is_active: isActive }).then((res) => res.data);
}

export function updateTeacher(teacherId: string, payload: TeacherUpdatePayload) {
  return apiClient.patch<Teacher>(`/teachers/${teacherId}`, payload).then((res) => res.data);
}

export function getMyTeacherProfile() {
  return apiClient.get<Teacher>("/teachers/me").then((res) => res.data);
}

export function updateMyTeacherProfile(payload: Omit<TeacherUpdatePayload, "is_active">) {
  return apiClient.patch<Teacher>("/teachers/me", payload).then((res) => res.data);
}
