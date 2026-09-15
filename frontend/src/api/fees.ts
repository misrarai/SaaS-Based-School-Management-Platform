import { apiClient } from "./client";

export type InvoiceType = "tuition" | "admission" | "other";
export type InvoiceStatus = "pending" | "paid" | "overdue" | "waived";
export type PaymentMethod = "jazzcash" | "easypaisa" | "nayapay" | "sadapay" | "bank_transfer" | "cash" | "other";
export type PaymentVerificationStatus = "pending" | "verified" | "rejected";

export interface FeePlan {
  id: string;
  class_grade_id: string;
  academic_year: string;
  monthly_amount: number;
  name: string | null;
}

export interface FeePlanCreatePayload {
  class_grade_id: string;
  academic_year: string;
  monthly_amount: number;
  name?: string;
}

export interface Invoice {
  id: string;
  student_id: string;
  class_grade_id: string;
  invoice_type: InvoiceType;
  invoice_number: string;
  period_month: number | null;
  period_year: number | null;
  amount_due: number;
  discount_amount: number;
  net_amount: number;
  due_date: string;
  status: InvoiceStatus;
  notes: string | null;
}

export interface InvoiceCreatePayload {
  student_id: string;
  invoice_type: InvoiceType;
  amount_due: number;
  due_date: string;
  notes?: string;
}

export interface GenerateInvoicesPayload {
  class_grade_id: string;
  period_month: number;
  period_year: number;
  due_date: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_note: string | null;
  receipt_image_url: string | null;
  submitted_by_user_id: string;
  submitted_at: string;
  verification_status: PaymentVerificationStatus;
  verified_by_user_id: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
}

export interface PaymentDetail extends Payment {
  student_id: string;
  student_name: string;
  invoice_number: string;
  invoice_type: InvoiceType;
}

export interface SubscriptionEntry {
  student_id: string;
  student_name: string;
  class_grade_id: string;
  class_grade_name: string;
  monthly_amount: number | null;
  current_status: InvoiceStatus | null;
  current_invoice_id: string | null;
}

export interface FeeReportSummary {
  period_month: number;
  period_year: number;
  total_collected: number;
  total_pending: number;
  total_overdue: number;
  by_method: Record<string, number>;
}

export function listFeePlans() {
  return apiClient.get<FeePlan[]>("/fees/plans").then((res) => res.data);
}

export function createFeePlan(payload: FeePlanCreatePayload) {
  return apiClient.post<FeePlan>("/fees/plans", payload).then((res) => res.data);
}

export function createInvoice(payload: InvoiceCreatePayload) {
  return apiClient.post<Invoice>("/fees/invoices", payload).then((res) => res.data);
}

export function generateInvoices(payload: GenerateInvoicesPayload) {
  return apiClient.post<Invoice[]>("/fees/invoices/generate", payload).then((res) => res.data);
}

export function listInvoices(filters?: { classGradeId?: string; status?: InvoiceStatus }) {
  const params = { class_grade_id: filters?.classGradeId || undefined, status: filters?.status || undefined };
  return apiClient.get<Invoice[]>("/fees/invoices", { params }).then((res) => res.data);
}

export function getInvoice(invoiceId: string) {
  return apiClient.get<Invoice>(`/fees/invoices/${invoiceId}`).then((res) => res.data);
}

export function submitPayment(
  invoiceId: string,
  payload: { amount: number; payment_method: PaymentMethod; reference_note?: string },
  receipt?: File,
) {
  const formData = new FormData();
  if (receipt) formData.append("receipt", receipt);
  return apiClient
    .post<Payment>(`/fees/invoices/${invoiceId}/payments`, formData, {
      params: {
        amount: payload.amount,
        payment_method: payload.payment_method,
        reference_note: payload.reference_note || undefined,
      },
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
}

export function listPendingPayments() {
  return apiClient.get<PaymentDetail[]>("/fees/payments/pending").then((res) => res.data);
}

export function listPayments(status?: PaymentVerificationStatus) {
  return apiClient.get<PaymentDetail[]>("/fees/payments", { params: { status } }).then((res) => res.data);
}

export interface InitiateGatewayPaymentResult {
  checkout_url: string;
  fields: Record<string, string>;
  txn_ref_no: string;
}

export function initiateJazzCashPayment(invoiceId: string) {
  return apiClient
    .post<InitiateGatewayPaymentResult>(`/fees/invoices/${invoiceId}/pay/jazzcash`)
    .then((res) => res.data);
}

/** Builds and submits a hidden HTML form so the browser POSTs straight to JazzCash's hosted
 * checkout page (not an XHR/fetch — the payer's browser must actually navigate there). */
export function redirectToJazzCashCheckout(result: InitiateGatewayPaymentResult) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = result.checkout_url;
  for (const [name, value] of Object.entries(result.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function verifyPayment(paymentId: string, approve: boolean, rejectionReason?: string) {
  return apiClient
    .post<Payment>(`/fees/payments/${paymentId}/verify`, { approve, rejection_reason: rejectionReason })
    .then((res) => res.data);
}

export function listSubscriptions() {
  return apiClient.get<SubscriptionEntry[]>("/fees/subscriptions").then((res) => res.data);
}

export function getReportSummary(periodMonth?: number, periodYear?: number) {
  return apiClient
    .get<FeeReportSummary>("/fees/reports/summary", { params: { period_month: periodMonth, period_year: periodYear } })
    .then((res) => res.data);
}
