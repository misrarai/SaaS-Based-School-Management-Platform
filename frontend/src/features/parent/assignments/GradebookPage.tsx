import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listMyChildren } from "../../../api/parents";
import { getGradebook, getSubjectPerformance } from "../../../api/assignments";
import { getProgress } from "../../../api/progress";

export function GradebookPage() {
  const childrenQuery = useQuery({ queryKey: ["parents", "me", "children"], queryFn: listMyChildren });
  const [studentId, setStudentId] = useState("");
  const effectiveStudentId = studentId || childrenQuery.data?.[0]?.id || "";

  const gradebookQuery = useQuery({
    queryKey: ["gradebook", effectiveStudentId],
    queryFn: () => getGradebook(effectiveStudentId),
    enabled: !!effectiveStudentId,
  });

  const progressQuery = useQuery({
    queryKey: ["progress", effectiveStudentId],
    queryFn: () => getProgress(effectiveStudentId),
    enabled: !!effectiveStudentId,
  });
  const performanceQuery = useQuery({
    queryKey: ["performance", effectiveStudentId],
    queryFn: () => getSubjectPerformance(effectiveStudentId),
    enabled: !!effectiveStudentId,
  });

  return (
    <AppShell title="Homework & Marks" navItems={parentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Homework &amp; Marks
      </Typography>

      <FormControl size="small" sx={{ minWidth: 200, mb: 3 }}>
        <InputLabel id="child-label">Child</InputLabel>
        <Select
          labelId="child-label"
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

      {progressQuery.data && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Overall performance
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip label={`Quiz average: ${Math.round(progressQuery.data.quiz_average_percent)}%`} color="primary" />
            <Chip label={`Assignments completed: ${Math.round(progressQuery.data.assignment_completion_percent)}%`} />
            <Chip label={`Attendance: ${Math.round(progressQuery.data.attendance_percent)}%`} />
            {(performanceQuery.data ?? []).map((p) => (
              <Chip
                key={p.subject_id}
                variant="outlined"
                label={`${p.subject_name}: ${p.average_percent != null ? `${Math.round(p.average_percent)}%` : "—"}`}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {gradebookQuery.data?.length === 0 && <Alert severity="info">No graded assignments yet.</Alert>}

      {!!gradebookQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Assignment</TableCell>
                <TableCell>Due date</TableCell>
                <TableCell>Marks</TableCell>
                <TableCell>Teacher feedback</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gradebookQuery.data.map((entry) => (
                <TableRow key={entry.assignment_id} hover>
                  <TableCell>{entry.assignment_title}</TableCell>
                  <TableCell>{new Date(entry.due_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {entry.marks_obtained} / {entry.max_marks ?? "—"}
                  </TableCell>
                  <TableCell>{entry.teacher_feedback || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
