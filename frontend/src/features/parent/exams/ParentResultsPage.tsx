import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { listMyChildren } from "../../../api/parents";
import { ExamResultsView } from "../../student/exams/ExamResultsView";

export function ParentResultsPage() {
  const childrenQuery = useQuery({ queryKey: ["parents", "me", "children"], queryFn: listMyChildren });
  const [studentId, setStudentId] = useState("");
  const effectiveStudentId = studentId || childrenQuery.data?.[0]?.id || "";

  return (
    <AppShell title="Exam Results" navItems={parentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Exam Results
      </Typography>

      <FormControl size="small" sx={{ minWidth: 200, mb: 3 }}>
        <InputLabel id="exam-child-label">Child</InputLabel>
        <Select
          labelId="exam-child-label"
          label="Child"
          value={effectiveStudentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          {childrenQuery.data?.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.full_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {childrenQuery.data?.length === 0 && <Alert severity="info">No children are linked to your account.</Alert>}
      {effectiveStudentId && <ExamResultsView key={effectiveStudentId} studentId={effectiveStudentId} />}
    </AppShell>
  );
}
