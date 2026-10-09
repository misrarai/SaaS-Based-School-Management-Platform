import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { getGradebook } from "../../../api/assignments";
import { listMyAttempts } from "../../../api/quizzes";

function pct(obtained: number | null, max: number | null) {
  if (obtained == null || !max) return null;
  return Math.round((obtained / max) * 100);
}

function PctChip({ value }: { value: number | null }) {
  if (value == null) return <>—</>;
  const color = value >= 80 ? "success" : value >= 50 ? "warning" : "error";
  return <Chip size="small" label={`${value}%`} color={color} variant="outlined" />;
}

export function MyMarksPage() {
  const gradebookQuery = useQuery({ queryKey: ["gradebook", "me"], queryFn: () => getGradebook() });
  const attemptsQuery = useQuery({ queryKey: ["quiz-attempts", "me"], queryFn: listMyAttempts });
  const attempts = (attemptsQuery.data ?? []).filter((a) => a.status !== "in_progress");

  return (
    <AppShell title="My Marks" navItems={studentNavItems}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Assignments
      </Typography>
      {gradebookQuery.isError && <Alert severity="error">Could not load assignment marks.</Alert>}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 4 }}>
        {gradebookQuery.isLoading && <LinearProgress />}
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Assignment</TableCell>
              <TableCell>Due date</TableCell>
              <TableCell align="right">Marks</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell>Teacher feedback</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(gradebookQuery.data ?? []).map((e) => (
              <TableRow key={e.assignment_id} hover>
                <TableCell>{e.assignment_title}</TableCell>
                <TableCell>{new Date(e.due_date).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  {e.marks_obtained ?? "—"} / {e.max_marks ?? "—"}
                </TableCell>
                <TableCell align="right">
                  <PctChip value={pct(e.marks_obtained, e.max_marks)} />
                </TableCell>
                <TableCell sx={{ color: e.teacher_feedback ? "text.primary" : "text.secondary" }}>
                  {e.teacher_feedback || "—"}
                </TableCell>
              </TableRow>
            ))}
            {!gradebookQuery.isLoading && (gradebookQuery.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  No graded assignments yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Quizzes &amp; tests
      </Typography>
      {attemptsQuery.isError && <Alert severity="error">Could not load quiz results.</Alert>}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        {attemptsQuery.isLoading && <LinearProgress />}
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Quiz</TableCell>
              <TableCell>Submitted</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell align="right">Percentage</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attempts.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>{a.quiz_title}</TableCell>
                <TableCell>{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "—"}</TableCell>
                <TableCell align="right">
                  {a.score ?? "—"} / {a.max_score}
                </TableCell>
                <TableCell align="right">
                  <PctChip value={a.percentage != null ? Math.round(a.percentage) : null} />
                </TableCell>
                <TableCell>{a.grade ?? "—"}</TableCell>
                <TableCell>
                  <Box component="span" sx={{ textTransform: "capitalize" }}>
                    {a.status === "submitted" ? "Awaiting grading" : a.status}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {!attemptsQuery.isLoading && attempts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  No quiz attempts yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </AppShell>
  );
}
