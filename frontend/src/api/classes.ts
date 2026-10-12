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
  class_teacher_id: string | null;
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

export function createSection(classId: string, name: string, classTeacherId?: string | null) {
  return apiClient
    .post<Section>(`/classes/${classId}/sections`, { name, class_teacher_id: classTeacherId || undefined })
    .then((res) => res.data);
}

export function listSubjects(classId: string) {
  return apiClient.get<Subject[]>(`/classes/${classId}/subjects`).then((res) => res.data);
}

export function createSubject(classId: string, payload: { name: string; code: string }) {
  return apiClient.post<Subject>(`/classes/${classId}/subjects`, payload).then((res) => res.data);
}

export interface SectionOverview extends Section {
  class_teacher_name: string | null;
  student_count: number;
}

export interface ClassOverview extends ClassGrade {
  student_count: number;
  sections: SectionOverview[];
  subjects: Subject[];
}

/** Every class with its sections (class teacher + head-count) and subjects in one call. */
export function getClassesOverview() {
  return apiClient.get<ClassOverview[]>("/classes/overview").then((res) => res.data);
}

export function updateClass(id: string, payload: Partial<{ name: string; level_order: number; academic_year_id: string }>) {
  return apiClient.patch<ClassGrade>(`/classes/${id}`, payload).then((res) => res.data);
}

export function deleteClass(id: string) {
  return apiClient.delete(`/classes/${id}`);
}

export function updateSection(id: string, payload: { name?: string; class_teacher_id?: string | null }) {
  const { class_teacher_id, ...rest } = payload;
  const body =
    class_teacher_id === undefined
      ? rest
      : class_teacher_id === null
        ? { ...rest, clear_class_teacher: true }
        : { ...rest, class_teacher_id };
  return apiClient.patch<Section>(`/sections/${id}`, body).then((res) => res.data);
}

export function deleteSection(id: string) {
  return apiClient.delete(`/sections/${id}`);
}

export function updateSubject(id: string, payload: { name?: string; code?: string }) {
  return apiClient.patch<Subject>(`/subjects/${id}`, payload).then((res) => res.data);
}

export function deleteSubject(id: string) {
  return apiClient.delete(`/subjects/${id}`);
}
