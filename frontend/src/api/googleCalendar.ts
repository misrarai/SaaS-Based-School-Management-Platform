import { apiClient } from "./client";

export interface GoogleCalendarStatus {
  connected: boolean;
  google_account_email: string | null;
  calendar_id: string | null;
}

export function getGoogleCalendarStatus() {
  return apiClient.get<GoogleCalendarStatus>("/integrations/google-calendar/status").then((res) => res.data);
}

/** Fetches the Google consent-screen URL and navigates the browser there directly (top-level
 * navigation, not a popup) — the admin approves access on Google's own page and lands back on
 * this app via the backend's callback redirect. */
export async function connectGoogleCalendar() {
  const res = await apiClient.get<{ authorization_url: string }>("/integrations/google-calendar/authorize");
  window.location.href = res.data.authorization_url;
}

export function disconnectGoogleCalendar() {
  return apiClient.delete("/integrations/google-calendar/disconnect");
}
