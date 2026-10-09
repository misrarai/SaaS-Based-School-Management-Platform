import { Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { MarksEntryPanel } from "../../admin/exams/MarksEntryPanel";

export function TeacherMarksEntryPage() {
  return (
    <AppShell title="Exam Marks" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Exam Marks Entry
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Enter term-exam marks for the classes and subjects you teach.
      </Typography>
      <MarksEntryPanel mode="teacher" />
    </AppShell>
  );
}
