import { isAxiosError } from "axios";

/** Best-effort human message from a FastAPI error response. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
}

/** Fetches a PDF (or other blob) via the authenticated axios client and saves/opens it. */
export function saveBlob(data: Blob, filename: string) {
  const url = window.URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
