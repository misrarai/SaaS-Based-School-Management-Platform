import { apiClient } from "./client";

export type MemberType = "student" | "teacher" | "staff";
export type CopyStatus = "available" | "issued" | "lost" | "damaged" | "reserved";
export type FineStatus = "none" | "accruing" | "unpaid" | "paid" | "waived";
export type ReservationStatus = "pending" | "ready" | "fulfilled" | "cancelled" | "expired";

export interface LibrarySettings {
  student_loan_days: number;
  teacher_loan_days: number;
  staff_loan_days: number;
  student_max_books: number;
  teacher_max_books: number;
  staff_max_books: number;
  fine_per_day: number;
  max_renewals: number;
  reservation_hold_days: number;
}

export interface BookCategory {
  id: string;
  name: string;
  description: string | null;
  book_count: number;
}

export interface BookFields {
  title: string;
  isbn?: string | null;
  author?: string | null;
  publisher?: string | null;
  edition?: string | null;
  category_id?: string | null;
  subject?: string | null;
  rack_location?: string | null;
  price?: number | null;
  purchase_date?: string | null;
  language?: string | null;
  description?: string | null;
}

export interface Book extends Required<BookFields> {
  id: string;
  category_name: string | null;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  reserved_copies: number;
  lost_copies: number;
  damaged_copies: number;
}

export interface BookCopy {
  id: string;
  book_id: string;
  accession_number: string;
  barcode: string | null;
  status: CopyStatus;
  notes: string | null;
}

export interface BookDetail extends Book {
  copies: BookCopy[];
}

export interface LibraryMember {
  id: string;
  member_type: MemberType;
  student_id: string | null;
  teacher_id: string | null;
  staff_id: string | null;
  card_number: string;
  status: "active" | "inactive";
  joined_on: string;
  full_name: string;
  reference: string | null;
  active_issues: number;
  outstanding_fine: number;
}

export interface BookIssue {
  id: string;
  copy_id: string;
  accession_number: string | null;
  book_id: string;
  book_title: string | null;
  book_author: string | null;
  member_id: string;
  member_name: string | null;
  member_type: MemberType | null;
  card_number: string | null;
  issued_on: string;
  due_date: string;
  returned_on: string | null;
  return_condition: string | null;
  renewals_count: number;
  status: "issued" | "returned" | "lost";
  is_overdue: boolean;
  days_overdue: number;
  fine_amount: number;
  fine_status: FineStatus;
  fine_paid_on: string | null;
  remarks: string | null;
}

export interface Reservation {
  id: string;
  book_id: string;
  book_title: string | null;
  member_id: string;
  member_name: string | null;
  card_number: string | null;
  reserved_at: string;
  status: ReservationStatus;
  copy_id: string | null;
  accession_number: string | null;
  ready_on: string | null;
  expires_on: string | null;
  queue_position: number | null;
}

export interface MyLibrary {
  member: LibraryMember | null;
  issues: BookIssue[];
  reservations: Reservation[];
  outstanding_fine: number;
  max_books: number;
  loan_days: number;
}

export interface ChildLibrary extends MyLibrary {
  student_id: string;
  student_name: string;
}

export interface FineReport {
  total_collected: number;
  total_waived: number;
  total_outstanding: number;
  items: BookIssue[];
}

export interface MostIssuedBook {
  book_id: string;
  title: string;
  author: string | null;
  issue_count: number;
}

export interface LibrarySummary {
  total_titles: number;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  reserved_copies: number;
  lost_copies: number;
  damaged_copies: number;
  total_members: number;
  overdue_count: number;
  pending_reservations: number;
  outstanding_fines: number;
}

const data = <T>(p: Promise<{ data: T }>) => p.then((res) => res.data);

export function libraryErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

// Settings
export const getLibrarySettings = () => data(apiClient.get<LibrarySettings>("/library/settings"));
export const updateLibrarySettings = (payload: Partial<LibrarySettings>) =>
  data(apiClient.put<LibrarySettings>("/library/settings", payload));

// Categories
export const listBookCategories = () => data(apiClient.get<BookCategory[]>("/library/categories"));
export const createBookCategory = (payload: { name: string; description?: string }) =>
  data(apiClient.post<BookCategory>("/library/categories", payload));
export const deleteBookCategory = (id: string) => apiClient.delete(`/library/categories/${id}`);

// Books
export const searchBooks = (params?: { q?: string; categoryId?: string; availableOnly?: boolean }) =>
  data(
    apiClient.get<Book[]>("/library/books", {
      params: {
        q: params?.q || undefined,
        category_id: params?.categoryId || undefined,
        available_only: params?.availableOnly || undefined,
      },
    }),
  );
export const getBook = (id: string) => data(apiClient.get<BookDetail>(`/library/books/${id}`));
export const createBook = (payload: BookFields & { copies?: number }) =>
  data(apiClient.post<BookDetail>("/library/books", payload));
export const updateBook = (id: string, payload: Partial<BookFields>) =>
  data(apiClient.patch<BookDetail>(`/library/books/${id}`, payload));
export const deleteBook = (id: string) => apiClient.delete(`/library/books/${id}`);

// Copies
export const addBookCopies = (
  bookId: string,
  payload: { accession_number?: string; barcode?: string; quantity?: number; notes?: string },
) => data(apiClient.post<BookCopy[]>(`/library/books/${bookId}/copies`, payload));
export const updateBookCopy = (
  copyId: string,
  payload: { accession_number?: string; barcode?: string | null; status?: "available" | "lost" | "damaged"; notes?: string | null },
) => data(apiClient.patch<BookCopy>(`/library/copies/${copyId}`, payload));
export const deleteBookCopy = (copyId: string) => apiClient.delete(`/library/copies/${copyId}`);

// Members
export const listLibraryMembers = (params?: { memberType?: MemberType | "all"; q?: string }) =>
  data(
    apiClient.get<LibraryMember[]>("/library/members", {
      params: { member_type: params?.memberType || undefined, q: params?.q || undefined },
    }),
  );
export const createLibraryMember = (payload: {
  member_type: MemberType;
  student_id?: string;
  teacher_id?: string;
  staff_id?: string;
}) => data(apiClient.post<LibraryMember>("/library/members", payload));
export const setLibraryMemberStatus = (id: string, status: "active" | "inactive") =>
  data(apiClient.post<LibraryMember>(`/library/members/${id}/status`, { status }));
export const downloadLibraryCard = (id: string) =>
  data(apiClient.get<Blob>(`/library/members/${id}/card`, { responseType: "blob" }));

// Circulation
export const listBookIssues = (params?: {
  status?: "issued" | "returned" | "lost" | "overdue" | "all";
  memberId?: string;
  q?: string;
}) =>
  data(
    apiClient.get<BookIssue[]>("/library/issues", {
      params: { status: params?.status || undefined, member_id: params?.memberId || undefined, q: params?.q || undefined },
    }),
  );
export const issueBook = (payload: {
  member_id: string;
  copy_id?: string;
  copy_identifier?: string;
  due_date?: string;
  remarks?: string;
}) => data(apiClient.post<BookIssue>("/library/issues", payload));

export interface ReturnPayload {
  condition?: "good" | "damaged" | "lost";
  returned_on?: string;
  extra_fine?: number;
  remarks?: string;
}
export const returnBookIssue = (issueId: string, payload: ReturnPayload) =>
  data(apiClient.post<BookIssue>(`/library/issues/${issueId}/return`, payload));
export const returnByCopy = (copyIdentifier: string, payload: ReturnPayload) =>
  data(apiClient.post<BookIssue>("/library/returns", { copy_identifier: copyIdentifier, ...payload }));
export const renewBookIssue = (issueId: string, dueDate?: string) =>
  data(apiClient.post<BookIssue>(`/library/issues/${issueId}/renew`, { due_date: dueDate || undefined }));
export const settleLibraryFine = (issueId: string, action: "paid" | "waived") =>
  data(apiClient.post<BookIssue>(`/library/issues/${issueId}/fine`, { action }));

// Reservations
export const listReservations = (status: "active" | "pending" | "ready" | "fulfilled" | "cancelled" | "expired" | "all" = "active") =>
  data(apiClient.get<Reservation[]>("/library/reservations", { params: { status } }));
export const createReservation = (payload: { book_id: string; member_id: string }) =>
  data(apiClient.post<Reservation>("/library/reservations", payload));
export const cancelReservation = (id: string) => data(apiClient.post<Reservation>(`/library/reservations/${id}/cancel`));

// Portal
export const getMyLibrary = () => data(apiClient.get<MyLibrary>("/library/me"));
export const reserveBookForMe = (bookId: string) =>
  data(apiClient.post<Reservation>("/library/me/reservations", { book_id: bookId }));
export const renewMyIssue = (issueId: string) => data(apiClient.post<BookIssue>(`/library/me/issues/${issueId}/renew`));
export const getChildrenLibrary = () => data(apiClient.get<ChildLibrary[]>("/library/children"));

// Reports
export const getLibrarySummary = () => data(apiClient.get<LibrarySummary>("/library/reports/summary"));
export const getOverdueReport = () => data(apiClient.get<BookIssue[]>("/library/reports/overdue"));
export const getFineReport = (params?: { dateFrom?: string; dateTo?: string; status?: "unpaid" | "paid" | "waived" }) =>
  data(
    apiClient.get<FineReport>("/library/reports/fines", {
      params: { date_from: params?.dateFrom || undefined, date_to: params?.dateTo || undefined, status: params?.status || undefined },
    }),
  );
export const getMostIssuedReport = (limit = 10) =>
  data(apiClient.get<MostIssuedBook[]>("/library/reports/most-issued", { params: { limit } }));
