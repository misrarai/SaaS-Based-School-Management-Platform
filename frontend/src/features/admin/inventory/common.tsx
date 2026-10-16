import type { ReactNode } from "react";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";

export { fmtMoney, todayIso, apiErrorMessage, PageHeader, DateField, FilterBar } from "../accounting/common";

export function InventoryShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell title={`Inventory — ${title}`} navItems={adminNavItems}>
      {children}
    </AppShell>
  );
}

export function StatTile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ flex: "1 1 150px", minWidth: 150, border: "1px solid #e0e0e0", borderRadius: 8, padding: 16 }}>
      <div style={{ color: "#667085", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? "inherit" }}>{value}</div>
    </div>
  );
}
