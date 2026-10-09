import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
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
import SaveIcon from "@mui/icons-material/SaveOutlined";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listSections } from "../../../api/classes";
import {
  getDatesheet,
  getMarksSheet,
  listExams,
  listMyTeachingSubjects,
  saveMarks,
  type MarksQuery,
  type MarksSheet,
} from "../../../api/exams";

interface RowState {
  obtained: string;
  absent: boolean;
  remarks: string;
}

function MarksGrid({ examId, query, sheet }: { examId: string; query: MarksQuery; sheet: MarksSheet }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      sheet.rows.map((r) => [
        r.student_id,
        { obtained: r.obtained_marks != null ? String(r.obtained_marks) : "", absent: r.is_absent, remarks: r.remarks ?? "" },
      ]),
    ),
  );
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      saveMarks(
        examId,
        query,
        sheet.rows.map((r) => {
          const s = rows[r.student_id];
          return {
            student_id: r.student_id,
            obtained_marks: s.absent || s.obtained === "" ? null : Number(s.obtained),
            is_absent: s.absent,
            remarks: s.remarks || null,
          };
        }),
      ),
    onSuccess: () => {
      setMessage({ type: "success", text: "Marks saved." });
      // Mark cached sheets stale without refetching now, so the grid keeps its state/message.
      queryClient.invalidateQueries({ queryKey: ["exams", examId, "marks"], refetchType: "none" });
      queryClient.invalidateQueries({ queryKey: ["exams", examId, "results"] });
    },
    onError: (err) => {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setMessage({ type: "error", text: typeof detail === "string" ? detail : "Could not save marks." });
    },
  });

  function update(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const entered = Object.values(rows).filter((r) => r.absent || r.obtained !== "").length;
  const invalid = Object.values(rows).some(
    (r) => !r.absent && r.obtained !== "" && (Number(r.obtained) < 0 || Number(r.obtained) > sheet.total_marks),
  );

  if (sheet.rows.length === 0) return <Alert severity="info">No students found for this class/section.</Alert>;

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        <strong>{sheet.subject_name}</strong> · Total {sheet.total_marks} · Passing {sheet.passing_marks} · Entered{" "}
        {entered}/{sheet.rows.length}
      </Typography>
      {sheet.locked && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Results for this exam are published — marks are locked. Ask an administrator to make changes.
        </Alert>
      )}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Roll</TableCell>
              <TableCell>Student</TableCell>
              <TableCell>Obtained / {sheet.total_marks}</TableCell>
              <TableCell>Absent</TableCell>
              <TableCell>Remarks</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sheet.rows.map((r, i) => {
              const s = rows[r.student_id];
              const value = Number(s.obtained);
              const outOfRange = !s.absent && s.obtained !== "" && (value < 0 || value > sheet.total_marks);
              let status: ReactNode = "—";
              if (s.absent) status = <Chip size="small" label="Absent" color="warning" />;
              else if (s.obtained !== "" && !outOfRange)
                status =
                  value >= sheet.passing_marks ? (
                    <Chip size="small" label="Pass" color="success" />
                  ) : (
                    <Chip size="small" label="Fail" color="error" />
                  );
              return (
                <TableRow key={r.student_id} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.roll_number ?? "—"}</TableCell>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={s.absent ? "" : s.obtained}
                      disabled={s.absent || sheet.locked}
                      error={outOfRange}
                      onChange={(e) => update(r.student_id, { obtained: e.target.value })}
                      slotProps={{ htmlInput: { min: 0, max: sheet.total_marks, step: "0.5" } }}
                      sx={{ width: 110 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={s.absent}
                      disabled={sheet.locked}
                      onChange={(e) => update(r.student_id, { absent: e.target.checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={s.remarks}
                      disabled={sheet.locked}
                      onChange={(e) => update(r.student_id, { remarks: e.target.value })}
                      sx={{ minWidth: 200 }}
                    />
                  </TableCell>
                  <TableCell>{status}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: "center" }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={() => save.mutate()}
          disabled={save.isPending || sheet.locked || invalid}
        >
          Save marks
        </Button>
        {message && <Alert severity={message.type} sx={{ py: 0 }}>{message.text}</Alert>}
      </Stack>
    </>
  );
}

/** Exam → class → section → subject selectors followed by the bulk marks grid. Teachers only see
 * the class/section/subject combinations they are timetabled for. */
export function MarksEntryPanel({ mode }: { mode: "admin" | "teacher" }) {
  const isTeacher = mode === "teacher";
  const examsQuery = useQuery({ queryKey: ["exams"], queryFn: listExams });
  const mySubjectsQuery = useQuery({
    queryKey: ["exams", "teacher", "my-subjects"],
    queryFn: listMyTeachingSubjects,
    enabled: isTeacher,
  });

  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const exam = examsQuery.data?.find((e) => e.id === examId);

  const classOptions = useMemo(() => {
    if (!exam) return [];
    if (!isTeacher) return exam.classes.map((c) => ({ id: c.class_grade_id, name: c.class_name }));
    const allowed = new Set(exam.classes.map((c) => c.class_grade_id));
    const map = new Map<string, string>();
    mySubjectsQuery.data?.forEach((s) => allowed.has(s.class_grade_id) && map.set(s.class_grade_id, s.class_name));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [exam, isTeacher, mySubjectsQuery.data]);

  const sectionsQuery = useQuery({
    queryKey: ["classes", classId, "sections"],
    queryFn: () => listSections(classId),
    enabled: !!classId && !isTeacher,
  });
  const datesheetQuery = useQuery({
    queryKey: ["exams", examId, "datesheet", classId],
    queryFn: () => getDatesheet(examId, { class_grade_id: classId }),
    enabled: !!examId && !!classId,
  });

  const sectionOptions = useMemo(() => {
    if (!isTeacher) return (sectionsQuery.data ?? []).map((s) => ({ id: s.id, name: s.name }));
    const map = new Map<string, string>();
    mySubjectsQuery.data?.forEach((s) => s.class_grade_id === classId && map.set(s.section_id, s.section_name));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [isTeacher, sectionsQuery.data, mySubjectsQuery.data, classId]);

  const subjectOptions = useMemo(() => {
    const onSheet = datesheetQuery.data ?? [];
    if (!isTeacher) return onSheet.map((d) => ({ id: d.subject_id, name: d.subject_name }));
    const mine = new Set(
      mySubjectsQuery.data?.filter((s) => s.section_id === sectionId).map((s) => s.subject_id) ?? [],
    );
    return onSheet.filter((d) => mine.has(d.subject_id)).map((d) => ({ id: d.subject_id, name: d.subject_name }));
  }, [datesheetQuery.data, isTeacher, mySubjectsQuery.data, sectionId]);

  const ready = !!examId && !!classId && !!subjectId && (!isTeacher || !!sectionId);
  const query: MarksQuery = { class_grade_id: classId, section_id: sectionId || null, subject_id: subjectId };
  const sheetQuery = useQuery({
    queryKey: ["exams", examId, "marks", query],
    queryFn: () => getMarksSheet(examId, query),
    enabled: ready,
  });

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="me-exam">Exam</InputLabel>
            <Select
              labelId="me-exam"
              label="Exam"
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setClassId("");
                setSectionId("");
                setSubjectId("");
              }}
            >
              {examsQuery.data?.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }} disabled={!examId}>
            <InputLabel id="me-class">Class</InputLabel>
            <Select
              labelId="me-class"
              label="Class"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId("");
                setSubjectId("");
              }}
            >
              {classOptions.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }} disabled={!classId}>
            <InputLabel id="me-section" shrink>
              Section
            </InputLabel>
            <Select
              labelId="me-section"
              label="Section"
              value={sectionId}
              displayEmpty
              notched
              onChange={(e) => {
                setSectionId(e.target.value);
                if (isTeacher) setSubjectId("");
              }}
            >
              {!isTeacher && <MenuItem value="">All sections</MenuItem>}
              {sectionOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }} disabled={!classId || (isTeacher && !sectionId)}>
            <InputLabel id="me-subject">Subject</InputLabel>
            <Select labelId="me-subject" label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjectOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        {examsQuery.data?.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            No exams have been created yet.
          </Typography>
        )}
        {isTeacher && !!examId && classOptions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            You are not timetabled for any class taking part in this exam.
          </Typography>
        )}
        {!!classId && datesheetQuery.data?.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            No papers are on this class's datesheet yet.
          </Typography>
        )}
      </Paper>

      {!ready && <Alert severity="info">Choose an exam, class{isTeacher ? ", section" : ""} and subject to enter marks.</Alert>}
      {sheetQuery.isError && <Alert severity="error">Could not load the marks sheet.</Alert>}
      {ready && sheetQuery.data && (
        <MarksGrid key={sheetQuery.dataUpdatedAt} examId={examId} query={query} sheet={sheetQuery.data} />
      )}
    </>
  );
}
