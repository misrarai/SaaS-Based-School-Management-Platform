import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import EventNoteIcon from "@mui/icons-material/EventNoteOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses } from "../../../api/classes";
import { listAcademicYears } from "../../../api/academicYears";
import {
  createExam,
  deleteExam,
  listExams,
  listGradingSchemes,
  updateExam,
  type Exam,
  type ExamPayload,
} from "../../../api/exams";
import { ExamTabs } from "./ExamTabs";

interface FormState {
  name: string;
  academic_year_id: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  grading_scheme_id: string;
  description: string;
  class_grade_ids: string[];
}

const EMPTY_FORM: FormState = {
  name: "",
  academic_year_id: "",
  academic_year: "",
  start_date: "",
  end_date: "",
  grading_scheme_id: "",
  description: "",
  class_grade_ids: [],
};

function formFromExam(exam: Exam): FormState {
  return {
    name: exam.name,
    academic_year_id: exam.academic_year_id ?? "",
    academic_year: exam.academic_year ?? "",
    start_date: exam.start_date ?? "",
    end_date: exam.end_date ?? "",
    grading_scheme_id: exam.grading_scheme_id ?? "",
    description: exam.description ?? "",
    class_grade_ids: exam.classes.map((c) => c.class_grade_id),
  };
}

function errorMessage(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function ExamsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const examsQuery = useQuery({ queryKey: ["exams"], queryFn: listExams });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const schemesQuery = useQuery({ queryKey: ["exams", "grading-schemes"], queryFn: listGradingSchemes });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    const defaultScheme = schemesQuery.data?.find((s) => s.is_default);
    setEditing(null);
    setForm({ ...EMPTY_FORM, grading_scheme_id: defaultScheme?.id ?? "" });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(exam: Exam) {
    setEditing(exam);
    setForm(formFromExam(exam));
    setError(null);
    setDialogOpen(true);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["exams"] });

  const save = useMutation({
    mutationFn: () => {
      const payload: ExamPayload = {
        name: form.name,
        academic_year_id: form.academic_year_id || null,
        academic_year: form.academic_year_id ? undefined : form.academic_year || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        grading_scheme_id: form.grading_scheme_id || null,
        description: form.description || null,
        class_grade_ids: form.class_grade_ids,
      };
      return editing ? updateExam(editing.id, payload) : createExam(payload);
    },
    onSuccess: () => {
      setDialogOpen(false);
      invalidate();
    },
    onError: (err) => setError(errorMessage(err, "Could not save exam.")),
  });

  const toggleStatus = useMutation({
    mutationFn: (exam: Exam) => updateExam(exam.id, { status: exam.status === "draft" ? "published" : "draft" }),
    onSuccess: invalidate,
  });

  const remove = useMutation({ mutationFn: (id: string) => deleteExam(id), onSuccess: invalidate });

  function toggleClass(id: string) {
    setForm((f) => ({
      ...f,
      class_grade_ids: f.class_grade_ids.includes(id)
        ? f.class_grade_ids.filter((c) => c !== id)
        : [...f.class_grade_ids, id],
    }));
  }

  return (
    <AppShell title="Examinations" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Exams</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New exam
        </Button>
      </Stack>
      <ExamTabs current="exams" />

      {examsQuery.isLoading && <Typography>Loading…</Typography>}
      {examsQuery.data?.length === 0 && (
        <Alert severity="info">No exams yet — click "New exam" to set up a term exam such as "Mid Term 2026".</Alert>
      )}

      {!!examsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Exam</TableCell>
                <TableCell>Year</TableCell>
                <TableCell>Dates</TableCell>
                <TableCell>Classes</TableCell>
                <TableCell>Grading</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Results</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {examsQuery.data.map((exam) => (
                <TableRow key={exam.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{exam.name}</Typography>
                    {exam.description && (
                      <Typography variant="caption" color="text.secondary">
                        {exam.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{exam.academic_year ?? "—"}</TableCell>
                  <TableCell>
                    {exam.start_date ?? "—"}
                    {exam.end_date ? ` → ${exam.end_date}` : ""}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                      {exam.classes.length === 0 && "—"}
                      {exam.classes.map((c) => (
                        <Chip key={c.class_grade_id} size="small" label={c.class_name} variant="outlined" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{exam.grading_scheme_name ?? "Built-in"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={exam.status}
                      color={exam.status === "published" ? "success" : "default"}
                      onClick={() => toggleStatus.mutate(exam)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={exam.results_published ? "Published" : "Hidden"}
                      color={exam.results_published ? "primary" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Datesheet">
                      <IconButton size="small" onClick={() => navigate(`/admin/exams/${exam.id}/datesheet`)}>
                        <EventNoteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(exam)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          if (window.confirm(`Delete "${exam.name}" with its datesheet and all marks?`)) {
                            remove.mutate(exam.id);
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit exam" : "New exam"}</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Exam name"
                placeholder="e.g. Mid Term 2026"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
                fullWidth
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="exam-year-label">Academic year</InputLabel>
                  <Select
                    labelId="exam-year-label"
                    label="Academic year"
                    value={form.academic_year_id}
                    onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                  >
                    <MenuItem value="">
                      <em>Other / free text</em>
                    </MenuItem>
                    {yearsQuery.data?.map((y) => (
                      <MenuItem key={y.id} value={y.id}>
                        {y.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {!form.academic_year_id && (
                  <TextField
                    label="Year (text)"
                    value={form.academic_year}
                    onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                    fullWidth
                  />
                )}
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Start date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
                <TextField
                  label="End date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Stack>
              <FormControl fullWidth>
                <InputLabel id="exam-scheme-label">Grading scheme</InputLabel>
                <Select
                  labelId="exam-scheme-label"
                  label="Grading scheme"
                  value={form.grading_scheme_id}
                  onChange={(e) => setForm({ ...form, grading_scheme_id: e.target.value })}
                >
                  <MenuItem value="">
                    <em>School default / built-in</em>
                  </MenuItem>
                  {schemesQuery.data?.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                      {s.is_default ? " (default)" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl component="fieldset">
                <FormLabel component="legend">Participating classes</FormLabel>
                <FormGroup row>
                  {classesQuery.data?.map((c) => (
                    <FormControlLabel
                      key={c.id}
                      control={
                        <Checkbox
                          checked={form.class_grade_ids.includes(c.id)}
                          onChange={() => toggleClass(c.id)}
                          size="small"
                        />
                      }
                      label={c.name}
                    />
                  ))}
                </FormGroup>
                {editing && (
                  <Typography variant="caption" color="text.secondary">
                    Unticking a class deletes its datesheet and marks for this exam.
                  </Typography>
                )}
              </FormControl>
              <TextField
                label="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                multiline
                minRows={2}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
