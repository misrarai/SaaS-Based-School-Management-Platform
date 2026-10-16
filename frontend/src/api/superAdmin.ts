import { apiClient } from "./client";

export interface TenantOut {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  is_active: boolean;
  plan: string;
  created_at: string;
  admin_count: number;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  contact_email: string;
  plan: string;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
}

export interface UpdateTenantRequest {
  name?: string;
  contact_email?: string;
  plan?: string;
  is_active?: boolean;
}

export interface SchoolAdminOut {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export interface CreateSchoolAdminRequest {
  full_name: string;
  email: string;
  password: string;
}

export interface PlatformStats {
  total_schools: number;
  active_schools: number;
  total_users: number;
}

export const listTenants = () =>
  apiClient.get<TenantOut[]>("/super-admin/tenants").then((r) => r.data);

export const createTenant = (data: CreateTenantRequest) =>
  apiClient.post<TenantOut>("/super-admin/tenants", data).then((r) => r.data);

export const updateTenant = (id: string, data: UpdateTenantRequest) =>
  apiClient.patch<TenantOut>(`/super-admin/tenants/${id}`, data).then((r) => r.data);

export const listSchoolAdmins = (tenantId: string) =>
  apiClient.get<SchoolAdminOut[]>(`/super-admin/tenants/${tenantId}/admins`).then((r) => r.data);

export const createSchoolAdmin = (tenantId: string, data: CreateSchoolAdminRequest) =>
  apiClient.post<SchoolAdminOut>(`/super-admin/tenants/${tenantId}/admins`, data).then((r) => r.data);

export const toggleAdminActive = (tenantId: string, userId: string) =>
  apiClient.patch<SchoolAdminOut>(`/super-admin/tenants/${tenantId}/admins/${userId}/toggle-active`, {}).then((r) => r.data);

export const getPlatformStats = () =>
  apiClient.get<PlatformStats>("/super-admin/stats").then((r) => r.data);
