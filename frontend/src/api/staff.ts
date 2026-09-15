import { apiClient } from "./client";

export interface StaffMember {
  id: string;
  employee_code: string;
  full_name: string;
  designation: string;
  phone: string | null;
  whatsapp_number: string | null;
  salary: number | null;
  status: "active" | "inactive";
  hire_date: string | null;
  notes: string | null;
}

export interface StaffCreatePayload {
  full_name: string;
  designation: string;
  phone?: string;
  whatsapp_number?: string;
  salary?: number;
  hire_date?: string;
  notes?: string;
}

export function listStaff(params?: { query?: string; status?: "active" | "inactive" | "all" }) {
  return apiClient
    .get<StaffMember[]>("/staff", { params: { q: params?.query || undefined, status: params?.status || undefined } })
    .then((res) => res.data);
}

export function createStaff(payload: StaffCreatePayload) {
  return apiClient.post<StaffMember>("/staff", payload).then((res) => res.data);
}

export function setStaffStatus(staffId: string, status: "active" | "inactive") {
  return apiClient.post<StaffMember>(`/staff/${staffId}/status`, { status }).then((res) => res.data);
}
