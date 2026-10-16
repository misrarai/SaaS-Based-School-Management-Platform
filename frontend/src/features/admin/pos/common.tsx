import type { ReactNode } from "react";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";

export { fmtMoney, todayIso, apiErrorMessage, PageHeader } from "../accounting/common";

export function PosShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell title={`Point of Sale — ${title}`} navItems={adminNavItems}>
      {children}
    </AppShell>
  );
}
