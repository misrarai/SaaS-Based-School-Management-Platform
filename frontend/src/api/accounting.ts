import { apiClient } from "./client";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type VoucherType = "CRV" | "CPV" | "BRV" | "BPV" | "JV";
export type VoucherStatus = "draft" | "posted";

export interface Account {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  parent_id: string | null;
  subtype: "cash" | "bank" | null;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  balance: number;
}

export interface AccountPayload {
  code: string;
  name: string;
  account_type: AccountType;
  parent_id?: string | null;
  subtype?: "cash" | "bank" | null;
  description?: string | null;
  is_active?: boolean;
}

export interface VoucherLineInput {
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface VoucherLine {
  id: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit: number;
  credit: number;
  description: string | null;
}

export interface Voucher {
  id: string;
  voucher_type: VoucherType;
  voucher_number: string;
  voucher_date: string;
  narration: string | null;
  reference: string | null;
  payee: string | null;
  attachment_url: string | null;
  status: VoucherStatus;
  source: string;
  reversal_of_id: string | null;
  reversed_by_id: string | null;
  posted_at: string | null;
  total_debit: number;
  total_credit: number;
  lines: VoucherLine[];
}

export interface VoucherPayload {
  voucher_type: VoucherType;
  voucher_date: string;
  narration?: string;
  reference?: string;
  payee?: string;
  attachment_url?: string;
  lines: VoucherLineInput[];
  post?: boolean;
}

export interface VoucherFilters {
  voucher_type?: VoucherType;
  status?: VoucherStatus;
  date_from?: string;
  date_to?: string;
  source?: string;
  q?: string;
}

export interface QuickEntryPayload {
  entry_type: "income" | "expense";
  head_account_id: string;
  cash_bank_account_id: string;
  amount: number;
  entry_date: string;
  payee?: string;
  description?: string;
  attachment_url?: string;
  reference?: string;
}

export interface Period {
  year: number;
  month: number;
  status: "open" | "closed";
  closed_at: string | null;
}

export interface LedgerEntry {
  entry_date: string;
  voucher_id: string;
  voucher_number: string;
  voucher_type: VoucherType;
  narration: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerReport {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  date_from: string | null;
  date_to: string | null;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  entries: LedgerEntry[];
}

export interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  total_debit: number;
  total_credit: number;
  debit_balance: number;
  credit_balance: number;
}

export interface TrialBalanceReport {
  as_of: string | null;
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export interface StatementRow {
  account_id: string | null;
  code: string;
  name: string;
  amount: number;
}

export interface IncomeStatementReport {
  date_from: string | null;
  date_to: string | null;
  income: StatementRow[];
  expenses: StatementRow[];
  total_income: number;
  total_expenses: number;
  net_profit: number;
}

export interface BalanceSheetReport {
  as_of: string;
  assets: StatementRow[];
  liabilities: StatementRow[];
  equity: StatementRow[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_liabilities_and_equity: number;
  is_balanced: boolean;
}

export interface DayBookReport {
  date_from: string | null;
  date_to: string | null;
  vouchers: Voucher[];
  total_debit: number;
  total_credit: number;
}

export interface MonthlyPoint {
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
}

export interface SyncResult {
  fee_vouchers_created: number;
  payout_vouchers_created: number;
  skipped_closed_period: number;
}

export interface SyncStatus {
  pending_fee_payments: number;
  pending_payouts: number;
}

const BASE = "/accounting";
const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null));

// Chart of accounts
export const listAccounts = (activeOnly = false) =>
  apiClient.get<Account[]>(`${BASE}/accounts`, { params: { active_only: activeOnly || undefined } }).then((r) => r.data);
export const createAccount = (payload: AccountPayload) =>
  apiClient.post<Account>(`${BASE}/accounts`, payload).then((r) => r.data);
export const updateAccount = (id: string, payload: Partial<AccountPayload>) =>
  apiClient.patch<Account>(`${BASE}/accounts/${id}`, payload).then((r) => r.data);
export const deleteAccount = (id: string) => apiClient.delete(`${BASE}/accounts/${id}`);
export const seedDefaultAccounts = () =>
  apiClient.post<{ created: number; total: number }>(`${BASE}/accounts/seed-defaults`).then((r) => r.data);

// Vouchers
export const listVouchers = (filters: VoucherFilters = {}) =>
  apiClient.get<Voucher[]>(`${BASE}/vouchers`, { params: clean(filters) }).then((r) => r.data);
export const createVoucher = (payload: VoucherPayload) =>
  apiClient.post<Voucher>(`${BASE}/vouchers`, payload).then((r) => r.data);
export const updateVoucher = (id: string, payload: Partial<VoucherPayload>) =>
  apiClient.patch<Voucher>(`${BASE}/vouchers/${id}`, payload).then((r) => r.data);
export const deleteVoucher = (id: string) => apiClient.delete(`${BASE}/vouchers/${id}`);
export const postVoucher = (id: string) => apiClient.post<Voucher>(`${BASE}/vouchers/${id}/post`).then((r) => r.data);
export const reverseVoucher = (id: string, payload: { reversal_date?: string; narration?: string } = {}) =>
  apiClient.post<Voucher>(`${BASE}/vouchers/${id}/reverse`, payload).then((r) => r.data);

export async function openVoucherPdf(id: string) {
  const response = await apiClient.get(`${BASE}/vouchers/${id}/pdf`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  window.open(url, "_blank");
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

// Quick entries
export const createQuickEntry = (payload: QuickEntryPayload) =>
  apiClient.post<Voucher>(`${BASE}/quick-entries`, payload).then((r) => r.data);
export const listQuickEntries = (params: { date_from?: string; date_to?: string } = {}) =>
  apiClient.get<Voucher[]>(`${BASE}/quick-entries`, { params: clean(params) }).then((r) => r.data);

// Periods
export const listPeriods = (year: number) =>
  apiClient.get<Period[]>(`${BASE}/periods`, { params: { year } }).then((r) => r.data);
export const closePeriod = (year: number, month: number) =>
  apiClient.post<Period>(`${BASE}/periods/close`, { year, month }).then((r) => r.data);
export const reopenPeriod = (year: number, month: number) =>
  apiClient.post<Period>(`${BASE}/periods/reopen`, { year, month }).then((r) => r.data);

// Sync
export const getSyncStatus = () => apiClient.get<SyncStatus>(`${BASE}/sync/status`).then((r) => r.data);
export const runSync = () => apiClient.post<SyncResult>(`${BASE}/sync`).then((r) => r.data);

// Reports
export const getLedger = (params: { account_id: string; date_from?: string; date_to?: string }) =>
  apiClient.get<LedgerReport>(`${BASE}/reports/ledger`, { params: clean(params) }).then((r) => r.data);
export const getCashBook = (params: { account_id?: string; date_from?: string; date_to?: string }) =>
  apiClient.get<LedgerReport>(`${BASE}/reports/cash-book`, { params: clean(params) }).then((r) => r.data);
export const getDayBook = (params: { date_from?: string; date_to?: string }) =>
  apiClient.get<DayBookReport>(`${BASE}/reports/day-book`, { params: clean(params) }).then((r) => r.data);
export const getTrialBalance = (asOf?: string) =>
  apiClient.get<TrialBalanceReport>(`${BASE}/reports/trial-balance`, { params: clean({ as_of: asOf }) }).then((r) => r.data);
export const getIncomeStatement = (params: { date_from?: string; date_to?: string }) =>
  apiClient.get<IncomeStatementReport>(`${BASE}/reports/income-statement`, { params: clean(params) }).then((r) => r.data);
export const getBalanceSheet = (asOf?: string) =>
  apiClient.get<BalanceSheetReport>(`${BASE}/reports/balance-sheet`, { params: clean({ as_of: asOf }) }).then((r) => r.data);
export const getMonthlySeries = (year: number) =>
  apiClient.get<MonthlyPoint[]>(`${BASE}/reports/monthly`, { params: { year } }).then((r) => r.data);
