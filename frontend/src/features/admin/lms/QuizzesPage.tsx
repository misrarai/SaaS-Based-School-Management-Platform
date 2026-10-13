import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AssessmentIcon from "@mui/icons-material/AssessmentOutlined";
import AddIcon from "@mui/icons-material/Add";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { getResults, listQuizzes, type Quiz } from "../../../api/quizzes";
import { LmsShell, PageHeader, useAcademics, fmtDateTime } from "./common";

function ResultsDialog({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const results = useQuery({ queryKey: ["lms-quiz-results", quiz.id], queryFn: () => getResults(quiz.id) });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Results — {quiz.title}</DialogTitle>
      <DialogContent>
        {results.isLoading ? (
          <Typography>Loading…</Typography>
        ) : (results.data?.length ?? 0) === 0 ? (
          <Alert severity="info">No attempts yet.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">%</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.data!.map((r) => (
                  <TableRow key={r.attempt_id} hover>
                    <TableCell>{r.student_name}</TableCell>
                    <TableCell align="right">{r.score ?? "—"} / {r.max_score}</TableCell>
                    <TableCell align="right">{r.percentage != null ? `${r.percentage}%` : "—"}</TableCell>
                    <TableCell>{r.grade ?? "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.needs_grading ? "needs grading" : r.status} color={r.needs_grading ? "warning" : r.status === "graded" ? "success" : "default"} />
                    </TableCell>
                    <TableCell>{fmtDateTime(r.submitted_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

export function AdminQuizzesPage() {
  const navigate = useNavigate();
  const academics = useAcademics();
  const [resultsFor, setResultsFor] = useState<Quiz | null>(null);
  const quizzes = useQuery({ queryKey: ["lms-quizzes"], queryFn: () => listQuizzes() });

  return (
    <LmsShell title="Quizzes">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <PageHeader title="Quizzes" />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/admin/lms/quizzes/new")}>
          Create Quiz
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Class · Section</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Teacher</TableCell>
              <TableCell align="right">Time limit</TableCell>
              <TableCell>Due</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quizzes.isLoading ? (
              <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>
            ) : (quizzes.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} sx={{ color: "text.secondary" }}>No quizzes yet.</TableCell></TableRow>
            ) : (
              quizzes.data!.map((q) => (
                <TableRow key={q.id} hover>
                  <TableCell>{q.title}</TableCell>
                  <TableCell>{academics.sectionLabel(q.section_id)}</TableCell>
                  <TableCell>{academics.subjectLabel(q.subject_id)}</TableCell>
                  <TableCell>{academics.teacherLabel(q.teacher_id)}</TableCell>
                  <TableCell align="right">{q.time_limit_minutes ? `${q.time_limit_minutes} min` : "—"}</TableCell>
                  <TableCell>{q.due_date ? fmtDateTime(q.due_date) : "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={q.is_published ? "Published" : "Draft"} color={q.is_published ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<AssessmentIcon />} onClick={() => setResultsFor(q)}>Results</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {resultsFor && <ResultsDialog quiz={resultsFor} onClose={() => setResultsFor(null)} />}
    </LmsShell>
  );
}
