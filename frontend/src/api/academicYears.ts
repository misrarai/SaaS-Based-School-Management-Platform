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
