import { Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { ExamResultsView } from "./ExamResultsView";

export function MyResultsPage() {
  return (
    <AppShell title="My Results" navItems={studentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Exams &amp; Results
      </Typography>
      <ExamResultsView />
    </AppShell>
  );
}
