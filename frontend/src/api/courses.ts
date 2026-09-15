import { apiClient } from "./client";

export interface CourseTeacherSummary {
  teacher_id: string;
  full_name: string;
  email: string;
}

export interface Course {
  id: string;
  academic_year_id: string;
  academic_year_name: string;
  class_grade_id: string;
  class_grade_name: string;
  section_id: string;
  section_name: string;
  subject_id: string;
  subject_name: string;
  is_active: boolean;
  teachers: CourseTeacherSummary[];
  student_count: number;
}

export interface TeacherAssignment {
  id: string;
  course_id: string;
  teacher_id: string;
  full_name: string;
  email: string;
  assigned_date: string;
  is_active: boolean;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  student_id: string;
  full_name: string;
  email: string;
  enrolled_date: string;
  status: "active" | "dropped";
}

export interface TeacherStudentSummary {
  student_id: string;
  full_name: string;
  email: string;
  class_grade_name: string;
  section_name: string;
  subjects: string[];
}

export interface CourseGradebookRow {
  student_id: string;
  full_name: string;
  email: string;
  assignments_graded: number;
  average_percent: number | null;
}

export interface CourseFilters {
  academic_year_id?: string;
  class_grade_id?: string;
  section_id?: string;
  subject_id?: string;
  student_id?: string;
}

export function listCourses(filters: CourseFilters = {}) {
  return apiClient.get<Course[]>("/courses", { params: filters }).then((res) => res.data);
}

export function getCourse(courseId: string, studentId?: string) {
  return apiClient
    .get<Course>(`/courses/${courseId}`, { params: studentId ? { student_id: studentId } : undefined })
    .then((res) => res.data);
}

export function createCourse(payload: { academic_year_id: string; section_id: string; subject_id: string }) {
  return apiClient.post<Course>("/courses", payload).then((res) => res.data);
}

export function assignTeacher(courseId: string, teacherId: string) {
  return apiClient
    .post<TeacherAssignment>(`/courses/${courseId}/teachers`, { teacher_id: teacherId })
    .then((res) => res.data);
}

export function unassignTeacher(courseId: string, teacherId: string) {
  return apiClient.delete(`/courses/${courseId}/teachers/${teacherId}`);
}

export function listCourseStudents(courseId: string) {
  return apiClient.get<CourseEnrollment[]>(`/courses/${courseId}/students`).then((res) => res.data);
}

export function enrollStudent(courseId: string, studentId: string) {
  return apiClient
    .post<CourseEnrollment>(`/courses/${courseId}/students`, { student_id: studentId })
    .then((res) => res.data);
}

export function dropStudent(courseId: string, studentId: string) {
  return apiClient.delete(`/courses/${courseId}/students/${studentId}`);
}

export function listMyStudents() {
  return apiClient.get<TeacherStudentSummary[]>("/courses/students/mine").then((res) => res.data);
}

export function getCourseGradebook(courseId: string) {
  return apiClient.get<CourseGradebookRow[]>(`/courses/${courseId}/gradebook`).then((res) => res.data);
}
