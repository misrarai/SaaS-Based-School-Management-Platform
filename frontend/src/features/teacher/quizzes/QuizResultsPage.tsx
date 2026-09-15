import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
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
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { getResults, type ResultEntry } from "../../../api/quizzes";

function statusChip(r: ResultEntry) {
  if (r.status === "graded") return <Chip size="small" label="Graded" color="success" />;
  if (r.needs_grading) return <Chip size="small" label="Needs grading" color="warning" />;
  if (r.status === "submitted") return <Chip size="small" label="Submitted" color="info" />;
  return <Chip size="small" label="In progress" color="default" />;
}

function gradeColor(grade: string | null): "success" | "warning" | "error" | "default" {
  if (grade === "A" || grade === "B") return "success";
  if (grade === "C" || grade === "D") return "warning";
  if (grade === "F") return "error";
  return "default";
}

export function QuizResultsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const resultsQuery = useQuery({
    queryKey: ["quiz-results", quizId],
    queryFn: () => getResults(quizId!),
    enabled: !!quizId,
  });

  return (
    <AppShell title="Quiz Results" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Results
      </Typography>

      {resultsQuery.data?.length === 0 && <Alert severity="info">No attempts yet.</Alert>}

      {!!resultsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Percentage</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resultsQuery.data.map((r) => (
                <TableRow key={r.attempt_id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.student_name}</TableCell>
                  <TableCell>{statusChip(r)}</TableCell>
                  <TableCell>{r.score !== null ? `${r.score} / ${r.max_score}` : `— / ${r.max_score}`}</TableCell>
                  <TableCell>{r.percentage !== null ? `${r.percentage}%` : "—"}</TableCell>
                  <TableCell>
                    {r.grade ? <Chip size="small" label={r.grade} color={gradeColor(r.grade)} /> : "—"}
                  </TableCell>
                  <TableCell>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</TableCell>
                  <TableCell align="right">
                    {r.needs_grading && (
                      <Button
                        size="small"
                        variant="contained"
                        component={RouterLink}
                        to={`/teacher/quizzes/attempts/${r.attempt_id}/grade`}
                      >
                        Grade
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
