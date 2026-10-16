import { apiClient } from "./client";

const BASE = "/holidays";

export type HolidayType = "public" | "school" | "exam" | "event";

export interface Holiday {
  id: string;
  name: string;
  from_date: string;
  to_date: string;
  holiday_type: HolidayType;
  description: string | null;
  is_recurring: boolean;
  days: number;
}

export const listHolidays = (year?: number) =>
  apiClient.get<Holiday[]>(BASE, { params: { year } }).then((r) => r.data);
export const createHoliday = (p: { name: string; from_date: string; to_date?: string; holiday_type?: HolidayType; description?: string }) =>
  apiClient.post<Holiday>(BASE, p).then((r) => r.data);
export const deleteHoliday = (id: string) => apiClient.delete(`${BASE}/${id}`);
