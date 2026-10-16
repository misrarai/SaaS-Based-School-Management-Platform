import { apiClient } from "./client";

// ─── Enums ───────────────────────────────────────────────────────────────────

export type FeeFrequency = "monthly" | "one_time" | "annual" | "per_term";
export type ConcessionType = "PERCENTAGE" | "FIXED";
export type PaymentMethod = "CASH" | "BANK" | "ONLINE" | "JAZZCASH" | "EASYPAISA";
export type InvoiceStatus = "pending" | "partial" | "paid" | "overdue" | "cancelled";

// ─── Fee Heads ───────────────────────────────────────────────────────────────

export interface FeeHead {
  id: string;
  name: string;
  code: string | null;
  default_frequency: FeeFrequency;
  description: string | null;
  is_active: boolean;
}

export function listFeeHeads(activeOnly = false): Promise<FeeHead[]> {
  return apiClient.get("/fee-collection/heads", { params: { active_only: activeOnly } }).then((r) => r.data);
}

export function createFeeHead(payload: { name: string; code?: string; default_frequency?: FeeFrequency; description?: string }): Promise<FeeHead> {
  return apiClient.post("/fee-collection/heads", payload).then((r) => r.data);
}

export function seedDefaultFeeHeads(): Promise<FeeHead[]> {
  return apiClient.post("/fee-collection/heads/seed-defaults").then((r) => r.data);
}

export function updateFeeHead(headId: string, payload: Partial<{ name: string; code: string; default_frequency: FeeFrequency; description: string; is_active: boolean }>): Promise<FeeHead> {
  return apiClient.patch(`/fee-collection/heads/${headId}`, payload).then((r) => r.data);
}

export function deleteFeeHead(headId: string): Promise<void> {
  return apiClient.delete(`/fee-collection/heads/${headId}`).then((r) => r.data);
}

// ─── Fee Structure ────────────────────────────────────────────────────────────

export interface FeeStructureItem {
  id: string;
  class_grade_id: string;
  fee_head_id: string;
  fee_head_name: string;
  amount: number;
  frequency: FeeFrequency;
}

export interface FeeStructure {
  class_grade_id: string;
  class_grade_name: string;
  items: FeeStructureItem[];
  monthly_total: number;
}

export function getFeeStructure(classGradeId: string): Promise<FeeStructure> {
  return apiClient.get(`/fee-collection/structure/${classGradeId}`).then((r) => r.data);
}

export function setFeeStructure(classGradeId: string, items: { fee_head_id: string; amount: number; frequency: FeeFrequency }[]): Promise<FeeStructure> {
  return apiClient.put(`/fee-collection/structure/${classGradeId}`, { items }).then((r) => r.data);
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  student_id: string;
  student_name: string;
  admission_number: string | null;
  class_grade_id: string;
  class_grade_name: string;
  invoice_type: string;
  period_month: number | null;
  period_year: number | null;
  due_date: string;
  status: InvoiceStatus;
  amount_due: number;
  discount_amount: number;
  late_fee_amount: number;
  net_amount: number;
  amount_paid: number;
  balance: number;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  fee_head_id: string | null;
  description: string;
  amount: number;
  concession_amount: number;
}

export interface GenerateResult {
  invoices_created: number;
  skipped_existing: number;
  invoices: InvoiceSummary[];
}

export function generateStructuredInvoices(payload: {
  class_grade_id: string;
  period_month: number;
  period_year: number;
  due_date: string;
  include_head_ids?: string[];
}): Promise<GenerateResult> {
  return apiClient.post("/fee-collection/invoices/generate", payload).then((r) => r.data);
}

export function listCollectionInvoices(params?: {
  class_grade_id?: string;
  period_month?: number;
  period_year?: number;
  open_only?: boolean;
}): Promise<InvoiceSummary[]> {
  return apiClient.get("/fee-collection/invoices", { params }).then((r) => r.data);
}

export function getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
  return apiClient.get(`/fee-collection/invoices/${invoiceId}/lines`).then((r) => r.data);
}

export function getVoucherPdfUrl(invoiceId: string): string {
  return `${apiClient.defaults.baseURL}/fee-collection/invoices/${invoiceId}/voucher.pdf`;
}

export function getBulkVoucherPdfUrl(params: { class_grade_id?: string; period_month?: number; period_year?: number; include_paid?: boolean }): string {
  const q = new URLSearchParams();
  if (params.class_grade_id) q.set("class_grade_id", params.class_grade_id);
  if (params.period_month) q.set("period_month", String(params.period_month));
  if (params.period_year) q.set("period_year", String(params.period_year));
  if (params.include_paid) q.set("include_paid", "true");
  return `${apiClient.defaults.baseURL}/fee-collection/vouchers/bulk.pdf?${q}`;
}

// ─── Counter ──────────────────────────────────────────────────────────────────

export interface CounterStudent {
  student_id: string;
  student_name: string;
  admission_number: string | null;
  class_grade_name: string | null;
  family_id: string | null;
}

export interface CounterSearchResult {
  family_id: string | null;
  family_number: string | null;
  family_name: string | null;
  students: CounterStudent[];
  outstanding: number;
}

export interface CounterAccount {
  family_id: string | null;
  family_number: string | null;
  family_name: string | null;
  students: CounterStudent[];
  open_invoices: InvoiceSummary[];
  total_outstanding: number;
  pending_late_fee: number;
}

export function searchCounter(q: string): Promise<CounterSearchResult[]> {
  return apiClient.get("/fee-collection/counter/search", { params: { q } }).then((r) => r.data);
}

export function getCounterAccount(params: { family_id?: string; student_id?: string; on_date?: string }): Promise<CounterAccount> {
  return apiClient.get("/fee-collection/counter/account", { params }).then((r) => r.data);
}

export interface CollectRequest {
  family_id?: string;
  student_id?: string;
  amount: number;
  payment_method?: PaymentMethod;
  collected_on?: string;
  reference_note?: string;
  invoice_ids?: string[];
}

export interface ReceiptAllocation {
  payment_id: string;
  invoice_id: string;
  invoice_number: string;
  student_name: string;
  amount: number;
  invoice_balance_after: number;
  invoice_status: InvoiceStatus;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  family_id: string | null;
  family_name: string | null;
  student_id: string | null;
  payer_name: string;
  total_amount: number;
  payment_method: PaymentMethod;
  collected_on: string;
  collected_by_name: string;
  reference_note: string | null;
  created_at: string;
  allocations: ReceiptAllocation[];
}

export function collectPayment(payload: CollectRequest): Promise<Receipt> {
  return apiClient.post("/fee-collection/counter/collect", payload).then((r) => r.data);
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

export function listReceipts(params?: { date_from?: string; date_to?: string; family_id?: string }): Promise<Receipt[]> {
  return apiClient.get("/fee-collection/receipts", { params }).then((r) => r.data);
}

export function getReceiptPdfUrl(receiptId: string): string {
  return `${apiClient.defaults.baseURL}/fee-collection/receipts/${receiptId}/pdf`;
}

// ─── Defaulters ───────────────────────────────────────────────────────────────

export interface DefaulterRow {
  student_id: string;
  student_name: string;
  admission_number: string | null;
  class_grade_id: string | null;
  class_grade_name: string | null;
  family_id: string | null;
  family_number: string | null;
  family_name: string | null;
  overdue_invoices: number;
  oldest_due_date: string;
  months_overdue: number;
  overdue_balance: number;
}

export interface ReminderResult {
  students_reminded: number;
  notifications_logged: number;
}

export function listDefaulters(params?: { class_grade_id?: string; min_amount?: number; months_overdue?: number }): Promise<DefaulterRow[]> {
  return apiClient.get("/fee-collection/defaulters", { params }).then((r) => r.data);
}

export function sendDefaulterReminders(payload: { student_ids?: string[]; class_grade_id?: string; min_amount?: number; months_overdue?: number }): Promise<ReminderResult> {
  return apiClient.post("/fee-collection/defaulters/remind", payload).then((r) => r.data);
}

export function getDefaultersExportUrl(): string {
  return `${apiClient.defaults.baseURL}/fee-collection/defaulters/export`;
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  entry_date: string;
  kind: "invoice" | "payment";
  reference: string;
  description: string;
  student_name: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface Ledger {
  family_id: string | null;
  family_number: string | null;
  family_name: string | null;
  students: CounterStudent[];
  entries: LedgerEntry[];
  total_billed: number;
  total_paid: number;
  closing_balance: number;
}

export function getLedger(params: { family_id?: string; student_id?: string }): Promise<Ledger> {
  return apiClient.get("/fee-collection/ledger", { params }).then((r) => r.data);
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface DailyCollectionReport {
  date_from: string;
  date_to: string;
  total: number;
  by_day: { day: string; total: number; count: number }[];
  by_method: Record<string, number>;
  by_collector: Record<string, number>;
  payments: {
    payment_id: string;
    collected_on: string;
    receipt_number: string | null;
    invoice_number: string;
    student_name: string;
    class_grade_name: string | null;
    payment_method: PaymentMethod;
    collector_name: string | null;
    amount: number;
  }[];
}

export function getDailyCollectionReport(params?: { date_from?: string; date_to?: string; payment_method?: PaymentMethod }): Promise<DailyCollectionReport> {
  return apiClient.get("/fee-collection/reports/daily-collection", { params }).then((r) => r.data);
}

export interface ClassCollectionSummary {
  period_month: number | null;
  period_year: number | null;
  rows: {
    class_grade_id: string;
    class_grade_name: string;
    students: number;
    invoices: number;
    billed: number;
    collected: number;
    outstanding: number;
  }[];
  total_billed: number;
  total_collected: number;
  total_outstanding: number;
}

export function getClassCollectionSummary(params?: { period_month?: number; period_year?: number }): Promise<ClassCollectionSummary> {
  return apiClient.get("/fee-collection/reports/class-summary", { params }).then((r) => r.data);
}

// ─── Concessions ─────────────────────────────────────────────────────────────

export interface Concession {
  id: string;
  student_id: string;
  student_name: string;
  fee_head_id: string | null;
  fee_head_name: string | null;
  concession_type: ConcessionType;
  value: number;
  reason: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
}

export function listConcessions(studentId?: string): Promise<Concession[]> {
  return apiClient.get("/fee-collection/concessions", { params: studentId ? { student_id: studentId } : undefined }).then((r) => r.data);
}

// ─── Late Fee Rule ─────────────────────────────────────────────────────────────

export interface LateFeeRule {
  amount: number;
  grace_days: number;
  is_active: boolean;
}

export function getLateFeeRule(): Promise<LateFeeRule> {
  return apiClient.get("/fee-collection/late-fee-rule").then((r) => r.data);
}

export function setLateFeeRule(payload: { amount: number; grace_days?: number; is_active?: boolean }): Promise<LateFeeRule> {
  return apiClient.put("/fee-collection/late-fee-rule", payload).then((r) => r.data);
}
