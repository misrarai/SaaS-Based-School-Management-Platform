import { apiClient } from "./client";
import type { FeeGenerateResult } from "./transport";

export type HostelType = "boys" | "girls" | "mixed";

export interface Hostel {
  id: string;
  name: string;
  hostel_type: HostelType;
  warden_name: string | null;
  warden_phone: string | null;
  address: string | null;
  status: "active" | "inactive";
  room_count: number;
  total_beds: number;
  occupied_beds: number;
}

export interface HostelPayload {
  name?: string;
  hostel_type?: HostelType;
  warden_name?: string | null;
  warden_phone?: string | null;
  address?: string | null;
  status?: Hostel["status"];
}

export interface HostelRoom {
  id: string;
  hostel_id: string;
  hostel_name: string | null;
  room_number: string;
  floor: string | null;
  room_type: string | null;
  capacity: number;
  monthly_fee: number;
  status: "active" | "inactive" | "maintenance";
  occupied: number;
  available: number;
}

export interface RoomPayload {
  room_number?: string;
  floor?: string | null;
  room_type?: string | null;
  capacity?: number;
  monthly_fee?: number;
  status?: HostelRoom["status"];
}

export interface HostelAllocation {
  id: string;
  student_id: string;
  student_name: string | null;
  hostel_id: string;
  hostel_name: string | null;
  room_id: string;
  room_number: string | null;
  bed_label: string | null;
  from_date: string;
  to_date: string | null;
  status: "active" | "vacated";
  monthly_fee: number;
  notes: string | null;
}

export interface HostelAllocationPayload {
  student_id: string;
  room_id: string;
  bed_label?: string | null;
  from_date: string;
  to_date?: string | null;
  notes?: string | null;
}

export interface HostelFeeRecord {
  id: string;
  student_id: string;
  student_name: string | null;
  allocation_id: string;
  invoice_id: string;
  invoice_number: string | null;
  invoice_status: string | null;
  period_month: number;
  period_year: number;
  amount: number;
}

export interface MessMenuEntry {
  id?: string;
  hostel_id?: string | null;
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

export type OutpassStatus = "pending" | "approved" | "rejected" | "returned";

export interface Outpass {
  id: string;
  student_id: string;
  student_name: string | null;
  hostel_id: string | null;
  hostel_name: string | null;
  out_at: string;
  expected_return_at: string;
  actual_return_at: string | null;
  reason: string;
  visitor_name: string | null;
  visitor_relation: string | null;
  status: OutpassStatus;
  approved_by_name: string | null;
  remarks: string | null;
  is_late: boolean;
}

export interface OutpassPayload {
  student_id: string;
  out_at: string;
  expected_return_at: string;
  reason: string;
  visitor_name?: string | null;
  visitor_relation?: string | null;
}

export interface OccupancyRow {
  hostel_id: string;
  hostel_name: string;
  hostel_type: HostelType;
  room_count: number;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  occupancy_percent: number;
  rooms: HostelRoom[];
}

export interface MyHostel {
  student_id: string;
  student_name: string | null;
  allocation_id: string | null;
  hostel_name: string | null;
  hostel_type: HostelType | null;
  warden_name: string | null;
  warden_phone: string | null;
  room_number: string | null;
  floor: string | null;
  room_type: string | null;
  bed_label: string | null;
  from_date: string | null;
  monthly_fee: number | null;
  mess_menu: MessMenuEntry[];
  outpasses: Outpass[];
}

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// Hostels
export const listHostels = () => data(apiClient.get<Hostel[]>("/hostel/hostels"));
export const createHostel = (payload: HostelPayload) => data(apiClient.post<Hostel>("/hostel/hostels", payload));
export const updateHostel = (id: string, payload: HostelPayload) =>
  data(apiClient.patch<Hostel>(`/hostel/hostels/${id}`, payload));
export const deleteHostel = (id: string) => apiClient.delete(`/hostel/hostels/${id}`);

// Rooms
export const listRooms = (hostelId?: string) =>
  data(apiClient.get<HostelRoom[]>("/hostel/rooms", { params: { hostel_id: hostelId || undefined } }));
export const createRoom = (hostelId: string, payload: RoomPayload) =>
  data(apiClient.post<HostelRoom>(`/hostel/hostels/${hostelId}/rooms`, payload));
export const updateRoom = (id: string, payload: RoomPayload) =>
  data(apiClient.patch<HostelRoom>(`/hostel/rooms/${id}`, payload));
export const deleteRoom = (id: string) => apiClient.delete(`/hostel/rooms/${id}`);

// Allocations
export const listHostelAllocations = (params?: { hostelId?: string; status?: "active" | "vacated" | "all" }) =>
  data(
    apiClient.get<HostelAllocation[]>("/hostel/allocations", {
      params: { hostel_id: params?.hostelId || undefined, status: params?.status || undefined },
    }),
  );
export const createHostelAllocation = (payload: HostelAllocationPayload) =>
  data(apiClient.post<HostelAllocation>("/hostel/allocations", payload));
export const vacateHostelAllocation = (id: string, toDate?: string) =>
  data(apiClient.post<HostelAllocation>(`/hostel/allocations/${id}/vacate`, { to_date: toDate || null }));

// Fees
export const generateHostelFees = (payload: { period_month: number; period_year: number; due_date: string }) =>
  data(apiClient.post<FeeGenerateResult<HostelFeeRecord>>("/hostel/fees/generate", payload));
export const listHostelFees = (params?: { month?: number; year?: number }) =>
  data(apiClient.get<HostelFeeRecord[]>("/hostel/fees", { params }));

// Mess menu
export const getMessMenu = (hostelId?: string) =>
  data(apiClient.get<MessMenuEntry[]>("/hostel/mess-menu", { params: { hostel_id: hostelId || undefined } }));
export const saveMessMenu = (hostelId: string | null, entries: MessMenuEntry[]) =>
  data(apiClient.put<MessMenuEntry[]>("/hostel/mess-menu", { hostel_id: hostelId, entries }));

// Outpasses
export const listOutpasses = (status?: OutpassStatus | "all") =>
  data(apiClient.get<Outpass[]>("/hostel/outpasses", { params: { status: status || undefined } }));
export const createOutpass = (payload: OutpassPayload) => data(apiClient.post<Outpass>("/hostel/outpasses", payload));
export const approveOutpass = (id: string, remarks?: string) =>
  data(apiClient.post<Outpass>(`/hostel/outpasses/${id}/approve`, { remarks: remarks || null }));
export const rejectOutpass = (id: string, remarks?: string) =>
  data(apiClient.post<Outpass>(`/hostel/outpasses/${id}/reject`, { remarks: remarks || null }));
export const markOutpassReturned = (id: string, actualReturnAt?: string) =>
  data(apiClient.post<Outpass>(`/hostel/outpasses/${id}/return`, { actual_return_at: actualReturnAt || null }));

// Reports & portal
export const getOccupancy = () => data(apiClient.get<OccupancyRow[]>("/hostel/reports/occupancy"));
export const getMyHostel = () => data(apiClient.get<MyHostel[]>("/hostel/me"));
