import { apiClient } from "./client";

export interface ClassGrade {
  id: string;
  name: string;
  level_order: number;
  academic_year: string;
  academic_year_id: string | null;
}

export interface Section {
  id: string;
  class_grade_id: string;
  name: string;
}

export interface Subject {
  id: string;
  class_grade_id: string;
  name: string;
  code: string;
}

export function listClasses() {
  return apiClient.get<ClassGrade[]>("/classes").then((res) => res.data);
}

export function createClass(payload: { name: string; level_order: number; academic_year?: string; academic_year_id?: string }) {
  return apiClient.post<ClassGrade>("/classes", payload).then((res) => res.data);
}

export function listSections(classId: string) {
  return apiClient.get<Section[]>(`/classes/${classId}/sections`).then((res) => res.data);
}

export function createSection(classId: string, name: string) {
  return apiClient.post<Section>(`/classes/${classId}/sections`, { name }).then((res) => res.data);
}

export function listSubjects(classId: string) {
  return apiClient.get<Subject[]>(`/classes/${classId}/subjects`).then((res) => res.data);
}

export function createSubject(classId: string, payload: { name: string; code: string }) {
  return apiClient.post<Subject>(`/classes/${classId}/subjects`, payload).then((res) => res.data);
}
