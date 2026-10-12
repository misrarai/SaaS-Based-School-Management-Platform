import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import {
  downloadDatesheetPdf,
  downloadResultCard,
  downloadTabulationPdf,
  getTabulation,
  listExams,
} from "../../../api/exams";

export function PrintReportsPage() {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");

  const exams = useQuery({ queryKey: ["exams"], queryFn: listExams });
  const exam = useMemo(() => exams.data?.find((e) => e.id === examId), [exams.data, examId]);

  // student list comes from the tabulation (has every student in the class)
  const tab = useQuery({
    queryKey: ["tabulation", examId, classId],
    queryFn: () => getTabulation(examId, classId),
    enabled: !!examId && !!classId,
  });
  const students = tab.data?.rows ?? [];

  const ready = !!examId && !!classId;

  return (
    <AppShell title="Examination — Print Reports" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>Print Reports</Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField select size="small" label="Exam" value={examId} onChange={(e) => { setExamId(e.target.value); setClassId(""); setStudentId(""); }} sx={{ minWidth: 220 }}>
          {(exams.data ?? []).map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Class" value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(""); }} disabled={!exam} sx={{ minWidth: 200 }}>
          {(exam?.classes ?? []).map((c) => <MenuItem key={c.class_grade_id} value={c.class_grade_id}>{c.class_name}</MenuItem>)}
        </TextField>
      </Paper>

      {!ready ? (
        <Alert severity="info">Pick an exam and class to print its reports.</Alert>
      ) : (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Class reports</Typography>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadDatesheetPdf(examId, { class_grade_id: classId })}>Date Sheet PDF</Button>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadTabulationPdf(examId, classId)}>Tabulation Sheet PDF</Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Student result card</Typography>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <TextField select size="small" label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)} sx={{ minWidth: 240 }} disabled={tab.isLoading}>
                {students.map((s) => <MenuItem key={s.student_id} value={s.student_id}>{s.full_name}{s.roll_number ? ` (${s.roll_number})` : ""}</MenuItem>)}
              </TextField>
              <Button variant="contained" startIcon={<DownloadIcon />} disabled={!studentId} onClick={() => downloadResultCard(examId, studentId)}>Result Card PDF</Button>
            </Stack>
            {tab.isLoading && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading students…</Typography>}
          </Paper>
        </Stack>
      )}
    </AppShell>
  );
}
