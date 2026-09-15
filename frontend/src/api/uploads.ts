import { apiClient } from "./client";

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient
    .post<{ url: string }>("/uploads/images", formData, { headers: { "Content-Type": "multipart/form-data" } })
    .then((res) => res.data.url);
}

export function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient
    .post<{ url: string }>("/uploads/documents", formData, { headers: { "Content-Type": "multipart/form-data" } })
    .then((res) => res.data.url);
}

export function resolveUploadUrl(url: string) {
  const base = apiClient.defaults.baseURL?.replace(/\/api\/v1\/?$/, "") ?? "";
  return url.startsWith("http") ? url : `${base}${url}`;
}
