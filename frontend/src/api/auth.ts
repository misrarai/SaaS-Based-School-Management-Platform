import { apiClient } from "./client";

export type Role = "admin" | "teacher" | "student" | "parent";

export interface UserOut {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  is_verified: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MessageResponse {
  message: string;
}

export function login(tenantSlug: string, email: string, password: string) {
  return apiClient
    .post<TokenPair>("/auth/login", { tenant_slug: tenantSlug, email, password })
    .then((res) => res.data);
}

export function fetchCurrentUser() {
  return apiClient.get<UserOut>("/auth/me").then((res) => res.data);
}

export function logout() {
  return apiClient.post<MessageResponse>("/auth/logout").then((res) => res.data);
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiClient
    .post<MessageResponse>("/auth/change-password", { current_password: currentPassword, new_password: newPassword })
    .then((res) => res.data);
}

export function forgotPassword(tenantSlug: string, email: string) {
  return apiClient
    .post<MessageResponse>("/auth/forgot-password", { tenant_slug: tenantSlug, email })
    .then((res) => res.data);
}

export function resetPassword(token: string, newPassword: string) {
  return apiClient
    .post<MessageResponse>("/auth/reset-password", { token, new_password: newPassword })
    .then((res) => res.data);
}

export function verifyEmail(token: string) {
  return apiClient.post<MessageResponse>("/auth/verify-email", { token }).then((res) => res.data);
}

export function resendVerification() {
  return apiClient.post<MessageResponse>("/auth/resend-verification").then((res) => res.data);
}
