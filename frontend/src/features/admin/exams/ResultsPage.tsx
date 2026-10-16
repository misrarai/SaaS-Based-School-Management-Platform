import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import CommentIcon from "@mui/icons-material/CommentOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listSections } from "../../../api/classes";
import {
  downloadResultCard,
  downloadTabulationPdf,
  getTabulation,
  listExams,
  publishResults,
  saveStudentRemarks,
  type StudentResult,
} from "../../../api/exams";
import { ExamTabs } from "./ExamTabs";

export function ResultsPage() {
  const queryClient = useQueryClient();
  const examsQuery = useQuery({ queryKey: ["exams"], queryFn: listExams });
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const exam = examsQuery.data?.find((e) => e.id === examId);

  const sectionsQuery = useQuery({
    queryKey: ["classes", classId, "sections"],
    queryFn: () => listSections(classId),
    enabled: !!classId,
  });
  const tabQuery = useQuery({
    queryKey: ["exams", examId, "results", classId, sectionId],
    queryFn: () => getTabulation(examId, classId, sectionId || null),
    enabled: !!examId && !!classId,
  });

  const publish = useMutation({
    mutationFn: (published: boolean) => publishResults(examId, published),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exams"] }),
  });

  const [remarkFor, setRemarkFor] = useState<StudentResult | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const saveRemark = useMutation({
    mutationFn: () => saveStudentRemarks(examId, remarkFor!.student_id, remarkText),
    onSuccess: () => {
      setRemarkFor(null);
      queryClient.invalidateQueries({ queryKey: ["exams", examId, "results"] });
    },
  });

  const tab = tabQuery.data;
  const passed = tab?.rows.filter((r) => r.passed).length ?? 0;

  return (
    <AppShell title="Examinations" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Results &amp; Tabulation
      </Typography>
      <ExamTabs current="results" />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="rs-exam">Exam</InputLabel>
            <Select
              labelId="rs-exam"
              label="Exam"
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setClassId("");
                setSectionId("");
              }}
            >
              {examsQuery.data?.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }} disabled={!exam}>
            <InputLabel id="rs-class">Class</InputLabel>
            <Select
              labelId="rs-class"
              label="Class"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId("");
              }}
            >
              {exam?.classes.map((c) => (
                <MenuItem key={c.class_grade_id} value={c.class_grade_id}>
                  {c.class_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }} disabled={!classId}>
            <InputLabel id="rs-section" shrink>
              Section
            </InputLabel>
            <Select
              labelId="rs-section"
              label="Section"
              value={sectionId}
              displayEmpty
              notched
              onChange={(e) => setSectionId(e.target.value)}
            >
              <MenuItem value="">All sections</MenuItem>
              {sectionsQuery.data?.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }} />
          {exam && (
            <FormControlLabel
              control={
                <Switch
                  checked={exam.results_published}
                  disabled={publish.isPending}
                  onChange={(e) => publish.mutate(e.target.checked)}
                />
              }
              label={exam.results_published ? "Results published" : "Results hidden from students/parents"}
            />
          )}
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            disabled={!tab?.rows.length}
            onClick={() => downloadTabulationPdf(examId, classId, sectionId || null)}
          >
            Tabulation PDF
          </Button>
        </Stack>
        {tab && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            <strong>{tab.rows.length}</strong> students · <strong>{passed}</strong> passed ·{" "}
            <strong>{tab.rows.length - passed}</strong> failed / incomplete
          </Typography>
        )}
      </Paper>

      {!classId && <Alert severity="info">Choose an exam and class to view the result sheet.</Alert>}
      {tab && tab.subjects.length === 0 && (
        <Alert severity="warning">No papers are on this class's datesheet yet.</Alert>
      )}

      {tab && tab.rows.length > 0 && tab.subjects.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Pos</TableCell>
                <TableCell>Roll</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Sec</TableCell>
                {tab.subjects.map((s) => (
                  <TableCell key={s.subject_id} align="center">
                    {s.subject_code || s.subject_name}
                    <br />
                    <Typography component="span" variant="caption" sx={{ color: "#cfd8e3" }}>
                      /{s.total_marks}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell align="center">Total</TableCell>
                <TableCell align="center">%</TableCell>
                <TableCell align="center">Grade</TableCell>
                <TableCell align="center">Result</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tab.rows.map((r) => (
                <TableRow key={r.student_id} hover>
                  <TableCell>{r.position ?? "—"}</TableCell>
                  <TableCell>{r.roll_number ?? "—"}</TableCell>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell>
                    {r.section_name ?? "—"}
                    {r.section_position ? ` (#${r.section_position})` : ""}
                  </TableCell>
                  {r.subjects.map((s) => {
                    const failed = !s.passed && (s.is_absent || s.obtained_marks != null);
                    return (
                      <TableCell key={s.subject_id} align="center" sx={{ color: failed ? "error.main" : undefined }}>
                        {s.is_absent ? "A" : (s.obtained_marks ?? "—")}
                      </TableCell>
                    );
                  })}
                  <TableCell align="center" sx={{ fontWeight: 600 }}>
                    {r.total_obtained}/{r.total_marks}
                  </TableCell>
                  <TableCell align="center">{r.percentage.toFixed(1)}</TableCell>
                  <TableCell align="center">{r.grade ?? "—"}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={r.passed ? "Pass" : "Fail"} color={r.passed ? "success" : "error"} />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title={r.remarks ? `Remarks: ${r.remarks}` : "Add remarks"}>
                      <IconButton
                        size="small"
                        color={r.remarks ? "primary" : "default"}
                        onClick={() => {
                          setRemarkFor(r);
                          setRemarkText(r.remarks ?? "");
                        }}
                      >
                        <CommentIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Result card (PDF)">
                      <IconButton size="small" onClick={() => downloadResultCard(examId, r.student_id)}>
                        <BadgeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!remarkFor} onClose={() => setRemarkFor(null)} fullWidth maxWidth="sm">
        <DialogTitle>Result card remarks — {remarkFor?.full_name}</DialogTitle>
        <DialogContent>
          <TextField
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            placeholder={remarkFor?.grade_remarks ?? "e.g. Consistent effort, keep it up."}
            multiline
            minRows={3}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemarkFor(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveRemark.mutate()} disabled={saveRemark.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
