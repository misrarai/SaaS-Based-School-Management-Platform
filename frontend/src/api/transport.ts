import { apiClient } from "./client";

export type VehicleType = "bus" | "van" | "car";
export type PickupType = "both" | "pickup" | "drop";

export interface TransportDriver {
  id: string;
  full_name: string;
  phone: string | null;
  cnic: string | null;
  license_number: string | null;
  license_expiry: string | null;
  address: string | null;
  salary: number | null;
  staff_id: string | null;
  status: "active" | "inactive";
}

export type DriverPayload = Partial<Omit<TransportDriver, "id">> & { full_name?: string };

export interface TransportVehicle {
  id: string;
  registration_number: string;
  vehicle_type: VehicleType;
  capacity: number;
  model: string | null;
  insurance_expiry: string | null;
  fitness_expiry: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  conductor_name: string | null;
  conductor_phone: string | null;
  status: "active" | "inactive" | "maintenance";
  allocated_count: number;
}

export interface VehiclePayload {
  registration_number?: string;
  vehicle_type?: VehicleType;
  capacity?: number;
  model?: string | null;
  insurance_expiry?: string | null;
  fitness_expiry?: string | null;
  driver_id?: string | null;
  conductor_name?: string | null;
  conductor_phone?: string | null;
  status?: TransportVehicle["status"];
}

export interface TransportStop {
  id: string;
  route_id: string;
  name: string;
  stop_order: number;
  pickup_time: string | null;
  drop_time: string | null;
  monthly_fare: number;
}

export interface StopPayload {
  name?: string;
  stop_order?: number;
  pickup_time?: string | null;
  drop_time?: string | null;
  monthly_fare?: number;
}

export interface TransportRoute {
  id: string;
  name: string;
  code: string | null;
  vehicle_id: string | null;
  vehicle_registration: string | null;
  vehicle_capacity: number | null;
  start_point: string | null;
  description: string | null;
  status: "active" | "inactive";
  stops: TransportStop[];
  allocated_count: number;
}

export interface RoutePayload {
  name?: string;
  code?: string | null;
  vehicle_id?: string | null;
  start_point?: string | null;
  description?: string | null;
  status?: TransportRoute["status"];
  stops?: StopPayload[];
}

export interface TransportAllocation {
  id: string;
  student_id: string;
  student_name: string | null;
  route_id: string;
  route_name: string | null;
  stop_id: string;
  stop_name: string | null;
  pickup_type: PickupType;
  start_date: string;
  end_date: string | null;
  status: "active" | "inactive";
  monthly_fare: number;
  notes: string | null;
}

export interface AllocationPayload {
  student_id: string;
  route_id: string;
  stop_id: string;
  pickup_type: PickupType;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
}

export interface TransportFeeRecord {
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

export interface FeeGenerateResult<T> {
  created_count: number;
  skipped_count: number;
  skipped: string[];
  records: T[];
}

export interface RouteStrengthRow {
  route_id: string;
  route_name: string;
  vehicle_registration: string | null;
  capacity: number | null;
  student_count: number;
  students: TransportAllocation[];
}

export interface ExpiringDocumentRow {
  kind: "vehicle_insurance" | "vehicle_fitness" | "driver_license";
  reference_id: string;
  label: string;
  expiry_date: string;
  days_left: number;
}

export interface MyTransport {
  student_id: string;
  student_name: string | null;
  allocation_id: string | null;
  route_name: string | null;
  route_code: string | null;
  stop_name: string | null;
  pickup_type: PickupType | null;
  pickup_time: string | null;
  drop_time: string | null;
  monthly_fare: number | null;
  vehicle_registration: string | null;
  vehicle_type: VehicleType | null;
  driver_name: string | null;
  driver_phone: string | null;
  conductor_name: string | null;
  conductor_phone: string | null;
}

const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// Drivers
export const listDrivers = () => data(apiClient.get<TransportDriver[]>("/transport/drivers"));
export const createDriver = (payload: DriverPayload) =>
  data(apiClient.post<TransportDriver>("/transport/drivers", payload));
export const updateDriver = (id: string, payload: DriverPayload) =>
  data(apiClient.patch<TransportDriver>(`/transport/drivers/${id}`, payload));
export const deleteDriver = (id: string) => apiClient.delete(`/transport/drivers/${id}`);

// Vehicles
export const listVehicles = () => data(apiClient.get<TransportVehicle[]>("/transport/vehicles"));
export const createVehicle = (payload: VehiclePayload) =>
  data(apiClient.post<TransportVehicle>("/transport/vehicles", payload));
export const updateVehicle = (id: string, payload: VehiclePayload) =>
  data(apiClient.patch<TransportVehicle>(`/transport/vehicles/${id}`, payload));
export const deleteVehicle = (id: string) => apiClient.delete(`/transport/vehicles/${id}`);

// Routes & stops
export const listRoutes = () => data(apiClient.get<TransportRoute[]>("/transport/routes"));
export const createRoute = (payload: RoutePayload) =>
  data(apiClient.post<TransportRoute>("/transport/routes", payload));
export const updateRoute = (id: string, payload: RoutePayload) =>
  data(apiClient.patch<TransportRoute>(`/transport/routes/${id}`, payload));
export const deleteRoute = (id: string) => apiClient.delete(`/transport/routes/${id}`);
export const addStop = (routeId: string, payload: StopPayload) =>
  data(apiClient.post<TransportStop>(`/transport/routes/${routeId}/stops`, payload));
export const updateStop = (id: string, payload: StopPayload) =>
  data(apiClient.patch<TransportStop>(`/transport/stops/${id}`, payload));
export const deleteStop = (id: string) => apiClient.delete(`/transport/stops/${id}`);

// Allocations
export const listTransportAllocations = (params?: { routeId?: string; status?: "active" | "inactive" | "all" }) =>
  data(
    apiClient.get<TransportAllocation[]>("/transport/allocations", {
      params: { route_id: params?.routeId || undefined, status: params?.status || undefined },
    }),
  );
export const createTransportAllocation = (payload: AllocationPayload) =>
  data(apiClient.post<TransportAllocation>("/transport/allocations", payload));
export const updateTransportAllocation = (id: string, payload: Partial<AllocationPayload>) =>
  data(apiClient.patch<TransportAllocation>(`/transport/allocations/${id}`, payload));
export const endTransportAllocation = (id: string, endDate?: string) =>
  data(apiClient.post<TransportAllocation>(`/transport/allocations/${id}/end`, { end_date: endDate || null }));

// Fees
export const generateTransportFees = (payload: { period_month: number; period_year: number; due_date: string }) =>
  data(apiClient.post<FeeGenerateResult<TransportFeeRecord>>("/transport/fees/generate", payload));
export const listTransportFees = (params?: { month?: number; year?: number }) =>
  data(apiClient.get<TransportFeeRecord[]>("/transport/fees", { params }));

// Reports
export const getRouteStrength = () => data(apiClient.get<RouteStrengthRow[]>("/transport/reports/route-strength"));
export const getExpiringDocuments = (days = 30) =>
  data(apiClient.get<ExpiringDocumentRow[]>("/transport/reports/expiring-documents", { params: { days } }));

// Portal
export const getMyTransport = () => data(apiClient.get<MyTransport[]>("/transport/me"));
