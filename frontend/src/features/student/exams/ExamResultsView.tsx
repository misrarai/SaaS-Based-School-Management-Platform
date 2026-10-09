import { useState } from "react";
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
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import EventNoteIcon from "@mui/icons-material/EventNoteOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  downloadDatesheetPdf,
  downloadResultCard,
  getStudentResult,
  listMyExams,
  type MyExam,
} from "../../../api/exams";

function ordinal(n: number | null) {
  if (n == null) return "—";
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

function ResultDialog({ exam, onClose }: { exam: MyExam; onClose: () => void }) {
  const resultQuery = useQuery({
    queryKey: ["exams", exam.exam_id, "student-result", exam.student_id],
    queryFn: () => getStudentResult(exam.exam_id, exam.student_id),
  });
  const data = resultQuery.data;
  const r = data?.result;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {exam.exam_name}
        {data ? ` — ${data.class_name}` : ""}
      </DialogTitle>
      <DialogContent>
        {resultQuery.isLoading && <Typography>Loading…</Typography>}
        {resultQuery.isError && <Alert severity="error">Could not load result.</Alert>}
        {r && (
          <>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
              <Table size="small">
                <TableHead sx={darkTableHeadSx}>
                  <TableRow>
                    <TableCell>Subject</TableCell>
                    <TableCell align="center">Total</TableCell>
                    <TableCell align="center">Passing</TableCell>
                    <TableCell align="center">Obtained</TableCell>
                    <TableCell align="center">Grade</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {r.subjects.map((s) => (
                    <TableRow key={s.subject_id}>
                      <TableCell>{s.subject_name}</TableCell>
                      <TableCell align="center">{s.total_marks}</TableCell>
                      <TableCell align="center">{s.passing_marks}</TableCell>
                      <TableCell
                        align="center"
                        sx={{ color: !s.passed && (s.is_absent || s.obtained_marks != null) ? "error.main" : undefined }}
                      >
                        {s.is_absent ? "Absent" : (s.obtained_marks ?? "—")}
                      </TableCell>
                      <TableCell align="center">{s.grade ?? "—"}</TableCell>
                      <TableCell>{s.remarks ?? ""}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ "& td": { fontWeight: 700 } }}>
                    <TableCell>Total</TableCell>
                    <TableCell align="center">{r.total_marks}</TableCell>
                    <TableCell />
                    <TableCell align="center">{r.total_obtained}</TableCell>
                    <TableCell align="center">{r.grade ?? "—"}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip label={`Percentage: ${r.percentage.toFixed(2)}%`} />
              <Chip label={`Grade: ${r.grade ?? "—"}`} />
              <Chip label={`Class position: ${ordinal(r.position)} of ${data.class_strength}`} />
              {r.section_position != null && <Chip label={`Section position: ${ordinal(r.section_position)}`} />}
              <Chip label={r.passed ? "PASS" : "FAIL"} color={r.passed ? "success" : "error"} />
            </Stack>
            {(r.remarks || r.grade_remarks) && (
              <Typography sx={{ mt: 2 }}>
                <strong>Remarks:</strong> {r.remarks || r.grade_remarks}
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button startIcon={<PictureAsPdfIcon />} onClick={() => downloadResultCard(exam.exam_id, exam.student_id)}>
          Download result card
        </Button>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Published exams + results for one student. Pass studentId for a parent viewing a child; omit
 * for the logged-in student. */
export function ExamResultsView({ studentId }: { studentId?: string }) {
  const examsQuery = useQuery({
    queryKey: ["exams", "my", studentId ?? "self"],
    queryFn: () => listMyExams(studentId),
  });
  const [open, setOpen] = useState<MyExam | null>(null);

  if (examsQuery.isLoading) return <Typography>Loading…</Typography>;
  if (examsQuery.isError) return <Alert severity="error">Could not load exams.</Alert>;
  if (!examsQuery.data?.length) return <Alert severity="info">No exams have been announced yet.</Alert>;

  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Exam</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell>Percentage</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Result</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {examsQuery.data.map((e) => (
              <TableRow key={e.exam_id} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{e.exam_name}</Typography>
                  {e.academic_year && (
                    <Typography variant="caption" color="text.secondary">
                      {e.academic_year}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {e.start_date ?? "—"}
                  {e.end_date ? ` → ${e.end_date}` : ""}
                </TableCell>
                {e.results_published ? (
                  <>
                    <TableCell>{e.percentage != null ? `${e.percentage.toFixed(1)}%` : "—"}</TableCell>
                    <TableCell>{e.grade ?? "—"}</TableCell>
                    <TableCell>{ordinal(e.position)}</TableCell>
                    <TableCell>
                      {e.passed != null && (
                        <Chip size="small" label={e.passed ? "Pass" : "Fail"} color={e.passed ? "success" : "error"} />
                      )}
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={4}>
                    <Chip size="small" label="Results not yet announced" />
                  </TableCell>
                )}
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Button
                    size="small"
                    startIcon={<EventNoteIcon />}
                    onClick={() => downloadDatesheetPdf(e.exam_id, { student_id: e.student_id })}
                  >
                    Datesheet
                  </Button>
                  {e.results_published && (
                    <>
                      <Button size="small" startIcon={<VisibilityIcon />} onClick={() => setOpen(e)}>
                        View
                      </Button>
                      <Button
                        size="small"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={() => downloadResultCard(e.exam_id, e.student_id)}
                      >
                        Result card
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {open && <ResultDialog exam={open} onClose={() => setOpen(null)} />}
    </>
  );
}
