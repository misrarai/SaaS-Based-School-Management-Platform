import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { CoursesManager } from "./CoursesManager";

export function CoursesPage() {
  return (
    <AppShell title="Courses" navItems={adminNavItems}>
      <CoursesManager />
    </AppShell>
  );
}
