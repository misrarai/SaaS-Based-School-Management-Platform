import { apiClient } from "./client";

export type StockTxnType = "purchase" | "issue" | "adjustment" | "transfer" | "sale";

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string | null;
}

export interface Store {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Item {
  id: string;
  name: string;
  code: string;
  category_id: string | null;
  category_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  reorder_level: number;
  sale_price: number | null;
  description: string | null;
  is_active: boolean;
  current_stock: number;
}

export interface ItemPayload {
  name: string;
  code?: string;
  category_id?: string | null;
  unit_id?: string | null;
  reorder_level?: number;
  sale_price?: number | null;
  description?: string | null;
  is_active?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
}

export type SupplierPayload = Omit<Supplier, "id">;

export interface StockLineInput {
  item_id: string;
  quantity: number;
  unit_price?: number;
}

export interface StockLine {
  id: string;
  item_id: string;
  item_name: string | null;
  item_code: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface StockTxn {
  id: string;
  txn_type: StockTxnType;
  txn_number: string;
  txn_date: string;
  store_id: string;
  store_name: string | null;
  to_store_id: string | null;
  to_store_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  invoice_no: string | null;
  issued_to_type: string | null;
  issued_to: string | null;
  reason: string | null;
  student_id: string | null;
  student_name: string | null;
  customer_name: string | null;
  payment_method: string | null;
  discount: number;
  total_amount: number;
  amount_paid: number | null;
  notes: string | null;
  lines: StockLine[];
}

export interface PurchasePayload {
  store_id: string;
  supplier_id?: string;
  txn_date: string;
  invoice_no?: string;
  notes?: string;
  lines: StockLineInput[];
}

export interface IssuePayload {
  store_id: string;
  txn_date: string;
  issued_to_type: "department" | "person" | "class";
  issued_to: string;
  notes?: string;
  lines: StockLineInput[];
}

export interface AdjustmentPayload {
  store_id: string;
  txn_date: string;
  reason: "damage" | "loss" | "expired" | "found" | "correction";
  direction: "increase" | "decrease";
  notes?: string;
  lines: StockLineInput[];
}

export interface TransferPayload {
  store_id: string;
  to_store_id: string;
  txn_date: string;
  notes?: string;
  lines: StockLineInput[];
}

export interface SalePayload {
  store_id: string;
  txn_date: string;
  student_id?: string;
  customer_name?: string;
  payment_method: "cash";
  discount?: number;
  amount_paid?: number;
  notes?: string;
  lines: StockLineInput[];
}

export interface StockLevel {
  item_id: string;
  item_name: string;
  item_code: string;
  unit_name: string | null;
  store_id: string;
  store_name: string;
  quantity: number;
  reorder_level: number;
}

export interface LowStockRow {
  item_id: string;
  item_name: string;
  item_code: string;
  unit_name: string | null;
  category_name: string | null;
  quantity: number;
  reorder_level: number;
  shortfall: number;
}

export type AssetCondition = "new" | "good" | "fair" | "poor" | "damaged";

export interface FixedAsset {
  id: string;
  asset_tag: string;
  name: string;
  category: string | null;
  location: string | null;
  supplier_id: string | null;
  purchase_date: string;
  cost: number;
  salvage_value: number;
  depreciation_rate: number;
  assigned_to: string | null;
  condition: AssetCondition;
  status: "active" | "disposed";
  disposal_date: string | null;
  disposal_value: number | null;
  disposal_notes: string | null;
  notes: string | null;
  accumulated_depreciation: number;
  book_value: number;
  annual_depreciation: number;
}

export interface AssetPayload {
  asset_tag?: string;
  name: string;
  category?: string;
  location?: string;
  supplier_id?: string;
  purchase_date: string;
  cost: number;
  salvage_value?: number;
  depreciation_rate?: number;
  assigned_to?: string;
  condition?: AssetCondition;
  notes?: string;
}

const BASE = "/inventory";

// Masters
export const listCategories = () => apiClient.get<Category[]>(`${BASE}/categories`).then((r) => r.data);
export const createCategory = (p: { name: string; description?: string }) =>
  apiClient.post<Category>(`${BASE}/categories`, p).then((r) => r.data);
export const deleteCategory = (id: string) => apiClient.delete(`${BASE}/categories/${id}`);
export const listUnits = () => apiClient.get<Unit[]>(`${BASE}/units`).then((r) => r.data);
export const createUnit = (p: { name: string; abbreviation?: string }) =>
  apiClient.post<Unit>(`${BASE}/units`, p).then((r) => r.data);
export const deleteUnit = (id: string) => apiClient.delete(`${BASE}/units/${id}`);
export const listStores = () => apiClient.get<Store[]>(`${BASE}/stores`).then((r) => r.data);
export const createStore = (p: { name: string; location?: string; description?: string }) =>
  apiClient.post<Store>(`${BASE}/stores`, p).then((r) => r.data);
export const updateStore = (id: string, p: Partial<Omit<Store, "id">>) =>
  apiClient.patch<Store>(`${BASE}/stores/${id}`, p).then((r) => r.data);
export const listSuppliers = () => apiClient.get<Supplier[]>(`${BASE}/suppliers`).then((r) => r.data);
export const createSupplier = (p: Partial<SupplierPayload> & { name: string }) =>
  apiClient.post<Supplier>(`${BASE}/suppliers`, p).then((r) => r.data);
export const updateSupplier = (id: string, p: Partial<SupplierPayload>) =>
  apiClient.patch<Supplier>(`${BASE}/suppliers/${id}`, p).then((r) => r.data);

// Items
export const listItems = (params: { q?: string; category_id?: string } = {}) =>
  apiClient
    .get<Item[]>(`${BASE}/items`, { params: { q: params.q || undefined, category_id: params.category_id || undefined } })
    .then((r) => r.data);
export const createItem = (p: ItemPayload) => apiClient.post<Item>(`${BASE}/items`, p).then((r) => r.data);
export const updateItem = (id: string, p: Partial<ItemPayload>) =>
  apiClient.patch<Item>(`${BASE}/items/${id}`, p).then((r) => r.data);

// Stock documents
export const listTransactions = (type?: StockTxnType) =>
  apiClient.get<StockTxn[]>(`${BASE}/transactions`, { params: { type: type || undefined } }).then((r) => r.data);
export const createPurchase = (p: PurchasePayload) =>
  apiClient.post<StockTxn>(`${BASE}/purchases`, p).then((r) => r.data);
export const createIssue = (p: IssuePayload) => apiClient.post<StockTxn>(`${BASE}/issues`, p).then((r) => r.data);
export const createAdjustment = (p: AdjustmentPayload) =>
  apiClient.post<StockTxn>(`${BASE}/adjustments`, p).then((r) => r.data);
export const createTransfer = (p: TransferPayload) =>
  apiClient.post<StockTxn>(`${BASE}/transfers`, p).then((r) => r.data);
export const createSale = (p: SalePayload) => apiClient.post<StockTxn>(`${BASE}/sales`, p).then((r) => r.data);

export async function openSaleReceipt(id: string) {
  const response = await apiClient.get(`${BASE}/sales/${id}/receipt`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  window.open(url, "_blank");
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

// Stock levels
export const listStockLevels = (params: { store_id?: string; item_id?: string } = {}) =>
  apiClient
    .get<StockLevel[]>(`${BASE}/stock`, {
      params: { store_id: params.store_id || undefined, item_id: params.item_id || undefined },
    })
    .then((r) => r.data);
export const listLowStock = () => apiClient.get<LowStockRow[]>(`${BASE}/stock/low`).then((r) => r.data);

// Fixed assets
export const listAssets = (status?: "active" | "disposed") =>
  apiClient.get<FixedAsset[]>(`${BASE}/assets`, { params: { status: status || undefined } }).then((r) => r.data);
export const createAsset = (p: AssetPayload) => apiClient.post<FixedAsset>(`${BASE}/assets`, p).then((r) => r.data);
export const updateAsset = (id: string, p: Partial<AssetPayload>) =>
  apiClient.patch<FixedAsset>(`${BASE}/assets/${id}`, p).then((r) => r.data);
export const disposeAsset = (id: string, p: { disposal_date: string; disposal_value?: number; disposal_notes?: string }) =>
  apiClient.post<FixedAsset>(`${BASE}/assets/${id}/dispose`, p).then((r) => r.data);
