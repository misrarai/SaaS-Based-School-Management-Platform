import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listSubjects, type Subject } from "../../../api/classes";
import {
  downloadDatesheetPdf,
  getDatesheet,
  getExam,
  saveDatesheet,
  type DatesheetEntry,
} from "../../../api/exams";

interface RowState {
  included: boolean;
  exam_date: string;
  start_time: string;
  end_time: string;
  total_marks: string;
  passing_marks: string;
  room: string;
}

function hhmm(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

function initialRows(subjects: Subject[], entries: DatesheetEntry[]): Record<string, RowState> {
  const bySubject = new Map(entries.map((e) => [e.subject_id, e]));
  const rows: Record<string, RowState> = {};
  for (const s of subjects) {
    const e = bySubject.get(s.id);
    rows[s.id] = e
      ? {
          included: true,
          exam_date: e.exam_date ?? "",
          start_time: hhmm(e.start_time),
          end_time: hhmm(e.end_time),
          total_marks: String(e.total_marks),
          passing_marks: String(e.passing_marks),
          room: e.room ?? "",
        }
      : { included: false, exam_date: "", start_time: "", end_time: "", total_marks: "100", passing_marks: "33", room: "" };
  }
  return rows;
}

function DatesheetEditor({
  examId,
  classGradeId,
  subjects,
  entries,
}: {
  examId: string;
  classGradeId: string;
  subjects: Subject[];
  entries: DatesheetEntry[];
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(() => initialRows(subjects, entries));
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      saveDatesheet(
        examId,
        classGradeId,
        subjects
          .filter((s) => rows[s.id]?.included)
          .map((s) => {
            const r = rows[s.id];
            return {
              subject_id: s.id,
              exam_date: r.exam_date || null,
              start_time: r.start_time ? `${r.start_time}:00` : null,
              end_time: r.end_time ? `${r.end_time}:00` : null,
              total_marks: Number(r.total_marks),
              passing_marks: Number(r.passing_marks),
              room: r.room || null,
            };
          }),
      ),
    onSuccess: () => {
      setMessage({ type: "success", text: "Datesheet saved." });
      queryClient.invalidateQueries({ queryKey: ["exams", examId, "datesheet"] });
    },
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setMessage({
        type: "error",
        text: typeof detail === "string" ? detail : Array.isArray(detail) ? String(detail[0]?.msg) : "Could not save datesheet.",
      });
    },
  });

  function update(subjectId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [subjectId]: { ...prev[subjectId], ...patch } }));
  }

  if (subjects.length === 0) {
    return <Alert severity="info">This class has no subjects. Add subjects under Academics → Classes & Subjects.</Alert>;
  }

  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell padding="checkbox">Incl.</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell>Total marks</TableCell>
              <TableCell>Passing marks</TableCell>
              <TableCell>Room</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subjects.map((s) => {
              const r = rows[s.id];
              const disabled = !r.included;
              return (
                <TableRow key={s.id} hover sx={{ opacity: disabled ? 0.55 : 1 }}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={r.included} onChange={(e) => update(s.id, { included: e.target.checked })} />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="date" value={r.exam_date} disabled={disabled}
                      onChange={(e) => update(s.id, { exam_date: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="time" value={r.start_time} disabled={disabled}
                      onChange={(e) => update(s.id, { start_time: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="time" value={r.end_time} disabled={disabled}
                      onChange={(e) => update(s.id, { end_time: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={r.total_marks} disabled={disabled} sx={{ width: 100 }}
                      onChange={(e) => update(s.id, { total_marks: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={r.passing_marks} disabled={disabled} sx={{ width: 100 }}
                      onChange={(e) => update(s.id, { passing_marks: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={r.room} disabled={disabled} sx={{ width: 110 }}
                      onChange={(e) => update(s.id, { room: e.target.value })} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Un-including a subject that already has marks will delete those marks when you save.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: "center" }}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={() => save.mutate()} disabled={save.isPending}>
          Save datesheet
        </Button>
        {message && <Alert severity={message.type} sx={{ py: 0 }}>{message.text}</Alert>}
      </Stack>
    </>
  );
}

export function DatesheetPage() {
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const examQuery = useQuery({ queryKey: ["exams", examId], queryFn: () => getExam(examId), enabled: !!examId });
  const [classId, setClassId] = useState("");
  const effectiveClassId = classId || examQuery.data?.classes[0]?.class_grade_id || "";

  const subjectsQuery = useQuery({
    queryKey: ["classes", effectiveClassId, "subjects"],
    queryFn: () => listSubjects(effectiveClassId),
    enabled: !!effectiveClassId,
  });
  const datesheetQuery = useQuery({
    queryKey: ["exams", examId, "datesheet", effectiveClassId],
    queryFn: () => getDatesheet(examId, { class_grade_id: effectiveClassId }),
    enabled: !!effectiveClassId,
  });

  return (
    <AppShell title="Examinations" navItems={adminNavItems}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/admin/exams")}>
          Exams
        </Button>
      </Stack>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Datesheet
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {examQuery.data?.name}
        {examQuery.data?.academic_year ? ` · ${examQuery.data.academic_year}` : ""}
      </Typography>

      {examQuery.data && examQuery.data.classes.length === 0 && (
        <Alert severity="warning">This exam has no participating classes. Edit the exam to add classes first.</Alert>
      )}

      {!!examQuery.data?.classes.length && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="ds-class-label">Class</InputLabel>
              <Select labelId="ds-class-label" label="Class" value={effectiveClassId}
                onChange={(e) => setClassId(e.target.value)}>
                {examQuery.data.classes.map((c) => (
                  <MenuItem key={c.class_grade_id} value={c.class_grade_id}>
                    {c.class_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              disabled={!datesheetQuery.data?.length}
              onClick={() => downloadDatesheetPdf(examId, { class_grade_id: effectiveClassId })}
            >
              Print datesheet
            </Button>
          </Stack>
        </Paper>
      )}

      {subjectsQuery.data && datesheetQuery.data && (
        <DatesheetEditor
          key={`${effectiveClassId}-${datesheetQuery.dataUpdatedAt}`}
          examId={examId}
          classGradeId={effectiveClassId}
          subjects={subjectsQuery.data}
          entries={datesheetQuery.data}
        />
      )}
    </AppShell>
  );
}
