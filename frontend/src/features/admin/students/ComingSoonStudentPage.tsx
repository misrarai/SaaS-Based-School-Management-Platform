import { Alert, Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";

export function ComingSoonStudentPage({ title, description }: { title: string; description: string }) {
  return (
    <AppShell title="Students" navItems={adminNavItems}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Alert severity="info">{description} This module isn't built yet — no reference design was provided for it.</Alert>
    </AppShell>
  );
}
