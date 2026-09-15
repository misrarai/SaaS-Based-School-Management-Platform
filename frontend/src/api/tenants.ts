import { apiClient } from "./client";
import type { UserOut } from "./auth";

export interface TenantOut {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  is_active: boolean;
  plan: string;
}

export interface TenantOnboardPayload {
  school_name: string;
  slug: string;
  contact_email: string;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
}

export interface TenantOnboardResponse {
  tenant: TenantOut;
  admin: UserOut;
}

export function onboardSchool(payload: TenantOnboardPayload) {
  return apiClient.post<TenantOnboardResponse>("/tenants/onboard", payload).then((res) => res.data);
}
