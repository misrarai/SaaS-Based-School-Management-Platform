import { apiClient } from "./client";

export type EmployeeType = "teacher" | "staff";
export type EmploymentType = "permanent" | "contract" | "visiting";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type PayrollStatus = "draft" | "approved" | "paid";
export type AdjustmentKind = "bonus" | "advance" | "fine";

export interface Department {
  id: string;
  name: string;
  description: string | null;
}

export interface Designation {
  id: string;
  name: string;
  department_id: string | null;
  description: string | null;
}

export interface EmployeeProfilePayload {
  cnic?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  qualification?: string | null;
  joining_date?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  department_id?: string | null;
  designation_id?: string | null;
  employment_type?: EmploymentType;
  contract_start?: string | null;
  contract_end?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
}

export interface EmployeeProfile extends Required<EmployeeProfilePayload> {
  id: string;
}

export interface Employee {
  employee_type: EmployeeType;
  employee_id: string;
  full_name: string;
  employee_code: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  department_name: string | null;
  designation_name: string | null;
  current_basic_salary: number | null;
  current_gross_salary: number | null;
  profile: EmployeeProfile | null;
}

export interface SalaryLine {
  type: string;
  name: string;
  amount: number;
}

export interface SalaryStructure {
  id: string;
  employee_type: EmployeeType;
  employee_id: string;
  employee_name: string;
  basic_salary: number;
  allowances: SalaryLine[];
  deductions: SalaryLine[];
  total_allowances: number;
  total_deductions: number;
  gross_salary: number;
  effective_from: string;
  notes: string | null;
}

export interface SalaryStructurePayload {
  employee_type: EmployeeType;
  employee_id: string;
  basic_salary: number;
  allowances: SalaryLine[];
  deductions: SalaryLine[];
  effective_from: string;
  notes?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  yearly_quota: number;
  is_paid: boolean;
  is_active: boolean;
}

export interface LeaveRequest {
  id: string;
  employee_type: EmployeeType;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  approver_user_id: string | null;
  approver_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  is_paid: boolean;
  yearly_quota: number;
  used: number;
  pending: number;
  remaining: number | null;
}

export interface LeaveApplyPayload {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  reason?: string;
}

export interface PayslipAdjustment {
  id: string;
  kind: AdjustmentKind;
  amount: number;
  note: string | null;
}

export interface Payslip {
  id: string;
  payroll_run_id: string;
  period_month: number;
  period_year: number;
  employee_type: EmployeeType;
  employee_id: string;
  employee_name: string;
  employee_code: string | null;
  designation: string | null;
  basic_salary: number;
  allowances: SalaryLine[];
  deductions: SalaryLine[];
  total_allowances: number;
  gross_salary: number;
  working_days: number;
  per_day_rate: number;
  absent_days: number;
  unpaid_leave_days: number;
  absence_deduction: number;
  structure_deductions: number;
  advance_deduction: number;
  bonus: number;
  adjustment_deduction: number;
  total_deductions: number;
  net_pay: number;
  status: PayrollStatus;
  paid_at: string | null;
  adjustments: PayslipAdjustment[];
}

export interface PayrollRun {
  id: string;
  period_month: number;
  period_year: number;
  status: PayrollStatus;
  notes: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  employee_count: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  skipped_employees: string[];
}

export interface PayrollRunDetail extends PayrollRun {
  payslips: Payslip[];
}

export interface SalaryAdvance {
  id: string;
  employee_type: EmployeeType;
  employee_id: string;
  employee_name: string;
  amount: number;
  monthly_installment: number;
  issued_on: string;
  reason: string | null;
  status: "active" | "repaid";
  amount_repaid: number;
  balance: number;
  created_at: string;
}

export interface SalaryAdvancePayload {
  employee_type: EmployeeType;
  employee_id: string;
  amount: number;
  monthly_installment: number;
  issued_on: string;
  reason?: string;
}

const BASE = "/payroll";

// --- employees ---
export function listEmployees(params?: { status?: "active" | "inactive" | "all"; q?: string }) {
  return apiClient
    .get<Employee[]>(`${BASE}/employees`, { params: { status: params?.status ?? "active", q: params?.q || undefined } })
    .then((r) => r.data);
}

export function saveEmployeeProfile(type: EmployeeType, id: string, payload: EmployeeProfilePayload) {
  return apiClient.put<EmployeeProfile>(`${BASE}/employees/${type}/${id}/profile`, payload).then((r) => r.data);
}

// --- departments / designations ---
export const listDepartments = () => apiClient.get<Department[]>(`${BASE}/departments`).then((r) => r.data);
export const createDepartment = (p: { name: string; description?: string }) =>
  apiClient.post<Department>(`${BASE}/departments`, p).then((r) => r.data);
export const updateDepartment = (id: string, p: { name?: string; description?: string | null }) =>
  apiClient.patch<Department>(`${BASE}/departments/${id}`, p).then((r) => r.data);
export const deleteDepartment = (id: string) => apiClient.delete(`${BASE}/departments/${id}`);

export const listDesignations = () => apiClient.get<Designation[]>(`${BASE}/designations`).then((r) => r.data);
export const createDesignation = (p: { name: string; department_id?: string | null; description?: string }) =>
  apiClient.post<Designation>(`${BASE}/designations`, p).then((r) => r.data);
export const updateDesignation = (
  id: string,
  p: { name?: string; department_id?: string | null; description?: string | null },
) => apiClient.patch<Designation>(`${BASE}/designations/${id}`, p).then((r) => r.data);
export const deleteDesignation = (id: string) => apiClient.delete(`${BASE}/designations/${id}`);

// --- salary structures ---
export const listSalaryStructures = (params?: { employee_type?: EmployeeType; employee_id?: string }) =>
  apiClient.get<SalaryStructure[]>(`${BASE}/salary-structures`, { params }).then((r) => r.data);
export const createSalaryStructure = (p: SalaryStructurePayload) =>
  apiClient.post<SalaryStructure>(`${BASE}/salary-structures`, p).then((r) => r.data);
export const deleteSalaryStructure = (id: string) => apiClient.delete(`${BASE}/salary-structures/${id}`);

// --- leave types ---
export const listLeaveTypes = (activeOnly = false) =>
  apiClient.get<LeaveType[]>(`${BASE}/leave-types`, { params: { active_only: activeOnly } }).then((r) => r.data);
export const createLeaveType = (p: { name: string; yearly_quota: number; is_paid: boolean }) =>
  apiClient.post<LeaveType>(`${BASE}/leave-types`, p).then((r) => r.data);
export const updateLeaveType = (id: string, p: Partial<Omit<LeaveType, "id">>) =>
  apiClient.patch<LeaveType>(`${BASE}/leave-types/${id}`, p).then((r) => r.data);

// --- leave requests (admin) ---
export const listLeaveRequests = (params?: { status?: LeaveStatus; employee_type?: EmployeeType; employee_id?: string }) =>
  apiClient.get<LeaveRequest[]>(`${BASE}/leaves`, { params }).then((r) => r.data);
export const createLeaveRequest = (p: LeaveApplyPayload & { employee_type: EmployeeType; employee_id: string }) =>
  apiClient.post<LeaveRequest>(`${BASE}/leaves`, p).then((r) => r.data);
export const approveLeave = (id: string, note?: string) =>
  apiClient.post<LeaveRequest>(`${BASE}/leaves/${id}/approve`, { note: note || null }).then((r) => r.data);
export const rejectLeave = (id: string, note?: string) =>
  apiClient.post<LeaveRequest>(`${BASE}/leaves/${id}/reject`, { note: note || null }).then((r) => r.data);
export const getLeaveBalances = (employee_type: EmployeeType, employee_id: string, year?: number) =>
  apiClient
    .get<LeaveBalance[]>(`${BASE}/leave-balances`, { params: { employee_type, employee_id, year } })
    .then((r) => r.data);

// --- teacher self-service ---
export const listMyLeaves = () => apiClient.get<LeaveRequest[]>(`${BASE}/my/leaves`).then((r) => r.data);
export const applyMyLeave = (p: LeaveApplyPayload) =>
  apiClient.post<LeaveRequest>(`${BASE}/my/leaves`, p).then((r) => r.data);
export const cancelMyLeave = (id: string) =>
  apiClient.post<LeaveRequest>(`${BASE}/my/leaves/${id}/cancel`).then((r) => r.data);
export const getMyLeaveBalances = (year?: number) =>
  apiClient.get<LeaveBalance[]>(`${BASE}/my/leave-balances`, { params: { year } }).then((r) => r.data);
export const listMyPayslips = () => apiClient.get<Payslip[]>(`${BASE}/my/payslips`).then((r) => r.data);

// --- payroll runs ---
export const listPayrollRuns = () => apiClient.get<PayrollRun[]>(`${BASE}/runs`).then((r) => r.data);
export const getPayrollRun = (id: string) => apiClient.get<PayrollRunDetail>(`${BASE}/runs/${id}`).then((r) => r.data);
export const generatePayrollRun = (p: { period_month: number; period_year: number; notes?: string }) =>
  apiClient.post<PayrollRun>(`${BASE}/runs`, p).then((r) => r.data);
export const approvePayrollRun = (id: string) =>
  apiClient.post<PayrollRun>(`${BASE}/runs/${id}/approve`).then((r) => r.data);
export const markPayrollRunPaid = (id: string) =>
  apiClient.post<PayrollRun>(`${BASE}/runs/${id}/mark-paid`).then((r) => r.data);
export const deletePayrollRun = (id: string) => apiClient.delete(`${BASE}/runs/${id}`);
export const addPayslipAdjustment = (payslipId: string, p: { kind: AdjustmentKind; amount: number; note?: string }) =>
  apiClient.post<Payslip>(`${BASE}/payslips/${payslipId}/adjustments`, p).then((r) => r.data);
export const removePayslipAdjustment = (payslipId: string, adjustmentId: string) =>
  apiClient.delete<Payslip>(`${BASE}/payslips/${payslipId}/adjustments/${adjustmentId}`).then((r) => r.data);

// --- advances ---
export const listAdvances = (params?: { status?: "active" | "repaid" }) =>
  apiClient.get<SalaryAdvance[]>(`${BASE}/advances`, { params }).then((r) => r.data);
export const createAdvance = (p: SalaryAdvancePayload) =>
  apiClient.post<SalaryAdvance>(`${BASE}/advances`, p).then((r) => r.data);
export const deleteAdvance = (id: string) => apiClient.delete(`${BASE}/advances/${id}`);

// --- downloads (authenticated, so fetched as blobs) ---
async function fetchBlob(url: string) {
  const response = await apiClient.get<Blob>(url, { responseType: "blob" });
  return response.data;
}

/** Opens an authenticated PDF in a new tab. The tab is opened synchronously (inside the click
 * handler) so popup blockers allow it, then pointed at the blob once it has downloaded. */
export async function openPdf(url: string, filename = "document.pdf") {
  const win = window.open("", "_blank");
  try {
    const blob = await fetchBlob(url);
    const objectUrl = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    if (win) {
      win.location.href = objectUrl;
    } else {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    win?.close();
    throw error;
  }
}

export async function downloadFile(url: string, filename: string) {
  const blob = await fetchBlob(url);
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export const payslipPdfUrl = (id: string) => `${BASE}/payslips/${id}/pdf`;
export const myPayslipPdfUrl = (id: string) => `${BASE}/my/payslips/${id}/pdf`;
export const payrollSheetPdfUrl = (runId: string) => `${BASE}/runs/${runId}/sheet.pdf`;
export const payrollSheetXlsxUrl = (runId: string) => `${BASE}/runs/${runId}/sheet.xlsx`;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function periodLabel(month: number, year: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function money(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function apiErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length && typeof detail[0]?.msg === "string") return detail[0].msg as string;
  return fallback;
}
