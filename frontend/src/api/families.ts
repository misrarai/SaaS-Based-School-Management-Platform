import { apiClient } from "./client";
import type { Student } from "./students";

export interface Family {
  id: string;
  family_number: string;
  family_name: string;
  cnic: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  notes: string | null;
}

export interface FamilyCreatePayload {
  family_name: string;
  cnic?: string;
  phone?: string;
  whatsapp_number?: string;
  notes?: string;
}

export function listFamilies(query?: string) {
  const params = query ? { q: query } : undefined;
  return apiClient.get<Family[]>("/families", { params }).then((res) => res.data);
}

export function createFamily(payload: FamilyCreatePayload) {
  return apiClient.post<Family>("/families", payload).then((res) => res.data);
}

export function listFamilyStudents(familyId: string) {
  return apiClient.get<Student[]>(`/families/${familyId}/students`).then((res) => res.data);
}

export function getNextFamilyNumber() {
  return apiClient
    .get<{ next_family_number: string }>("/families/next-number")
    .then((res) => res.data.next_family_number);
}

export function getFamily(familyId: string) {
  return apiClient.get<Family>(`/families/${familyId}`).then((res) => res.data);
}

export function updateFamily(familyId: string, payload: Partial<FamilyCreatePayload>) {
  return apiClient.patch<Family>(`/families/${familyId}`, payload).then((res) => res.data);
}
