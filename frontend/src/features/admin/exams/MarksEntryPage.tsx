import { Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { ExamTabs } from "./ExamTabs";
import { MarksEntryPanel } from "./MarksEntryPanel";

export function MarksEntryPage() {
  return (
    <AppShell title="Examinations" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Marks Entry
      </Typography>
      <ExamTabs current="marks" />
      <MarksEntryPanel mode="admin" />
    </AppShell>
  );
}
