import { apiClient } from "./client";
import type { Student } from "./students";

export function listMyChildren() {
  return apiClient.get<Student[]>("/parents/me/children").then((res) => res.data);
}

export function linkParent(
  studentId: string,
  payload: { full_name: string; email: string; password: string; phone_number?: string; relationship_label?: string },
) {
  return apiClient.post(`/students/${studentId}/parents`, payload).then((res) => res.data);
}
