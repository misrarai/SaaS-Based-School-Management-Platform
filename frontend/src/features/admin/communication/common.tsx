import type { ReactNode } from "react";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";

export {
  todayIso,
  fmtDate,
  fmtDateTime,
  localInputToIso,
  errorMessage,
  PageHeader,
  FilterTabs,
} from "../front-office/common";

export function CommunicationShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell title={`Communication — ${title}`} navItems={adminNavItems}>
      {children}
    </AppShell>
  );
}
