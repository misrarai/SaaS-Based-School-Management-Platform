import { apiClient } from "./client";

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export function listAcademicYears() {
  return apiClient.get<AcademicYear[]>("/academic-years").then((res) => res.data);
}

export function createAcademicYear(payload: { name: string; start_date: string; end_date: string; is_active?: boolean }) {
  return apiClient.post<AcademicYear>("/academic-years", payload).then((res) => res.data);
}

export function updateAcademicYear(
  id: string,
  payload: Partial<{ name: string; start_date: string; end_date: string; is_active: boolean }>,
) {
  return apiClient.patch<AcademicYear>(`/academic-years/${id}`, payload).then((res) => res.data);
}

export interface PromoteStudentsResult {
  students_promoted: number;
  students_graduated: number;
  promoted_by_class: { class_name: string; students_moved: number }[];
  graduated_classes: string[];
}

export function promoteStudents(fromAcademicYearId: string, toAcademicYearId: string) {
  return apiClient
    .post<PromoteStudentsResult>("/academic-years/promote", {
      from_academic_year_id: fromAcademicYearId,
      to_academic_year_id: toAcademicYearId,
    })
    .then((res) => res.data);
}
