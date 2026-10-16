import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
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
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import GroupsIcon from "@mui/icons-material/GroupsOutlined";
import { AppShell } from "../../components/AppShell";
import { darkTableHeadSx } from "../../components/tableStyles";
import { adminNavItems } from "./adminNav";
import {
  createClass,
  deleteClass,
  getClassesOverview,
  updateClass,
  type ClassOverview,
} from "../../api/classes";
import { listAcademicYears, type AcademicYear } from "../../api/academicYears";
import { listTeachers, type Teacher } from "../../api/teachers";
import { apiErrorMessage } from "../../lib/apiError";

const ALL = "all";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-PK");
}

// ─── Create / Edit Class Dialog ──────────────────────────────────────────────

interface ClassFormState {
  name: string;
  level_order: string;
  academic_year_id: string;
  class_fee: string;
  capacity: string;
  incharge_id: string | null;
  assistant_incharge_id: string | null;
}

function ClassDialog({
  open,
  editing,
  years,
  teachers,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: ClassOverview | null;
  years: AcademicYear[];
  teachers: Teacher[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const activeYear = years.find((y) => y.is_active);
  const [form, setForm] = useState<ClassFormState>({
    name: editing?.name ?? "",
    level_order: editing ? String(editing.level_order) : "",
    academic_year_id: editing?.academic_year_id ?? activeYear?.id ?? "",
    class_fee: editing?.class_fee != null ? String(editing.class_fee) : "",
    capacity: editing?.capacity != null ? String(editing.capacity) : "",
    incharge_id: editing?.incharge_id ?? null,
    assistant_incharge_id: editing?.assistant_incharge_id ?? null,
  });
  const [error, setError] = useState("");

  const set = (k: keyof ClassFormState, v: string | null) =>
    setForm((f) => ({ ...f, [k]: v as string }));

  const inchargeTeacher = teachers.find((t) => t.id === form.incharge_id) ?? null;
  const assistantTeacher = teachers.find((t) => t.id === form.assistant_incharge_id) ?? null;

  const saveMutation = useMutation({
    mutationFn: () => {
      const levelOrder = parseInt(form.level_order, 10);
      const classFee = form.class_fee ? parseFloat(form.class_fee) : null;
      const capacity = form.capacity ? parseInt(form.capacity, 10) : null;
      if (editing) {
        return updateClass(editing.id, {
          name: form.name.trim(),
          level_order: isNaN(levelOrder) ? undefined : levelOrder,
          academic_year_id: form.academic_year_id || undefined,
          class_fee: classFee,
          capacity,
          incharge_id: form.incharge_id,
          assistant_incharge_id: form.assistant_incharge_id,
          clear_incharge: form.incharge_id === null,
          clear_assistant: form.assistant_incharge_id === null,
        });
      }
      const selectedYear = years.find((y) => y.id === form.academic_year_id);
      return createClass({
        name: form.name.trim(),
        level_order: isNaN(levelOrder) ? 0 : levelOrder,
        academic_year_id: form.academic_year_id || undefined,
        academic_year: selectedYear?.name,
        class_fee: classFee,
        capacity,
        incharge_id: form.incharge_id,
        assistant_incharge_id: form.assistant_incharge_id,
      });
    },
    onSuccess: () => onSaved(editing ? "Class updated" : "Class created"),
    onError: (err) => setError(apiErrorMessage(err, "Could not save class.")),
  });

  function handleSave() {
    if (!form.name.trim()) { setError("Class name is required."); return; }
    if (!form.level_order || isNaN(parseInt(form.level_order, 10))) {
      setError("Level order (a number) is required."); return;
    }
    if (!editing && !form.academic_year_id) { setError("Please select an academic year."); return; }
    setError("");
    saveMutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
        {editing ? "Edit Class" : "Create New Class"}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" },
            gap: 2,
            mt: 1,
          }}
        >
          {/* Row 1: Incharge, Assistant Incharge, Class Name, Class Fee */}
          <Autocomplete
            options={teachers}
            getOptionLabel={(t) => t.full_name}
            value={inchargeTeacher}
            onChange={(_, t) => set("incharge_id", t?.id ?? null)}
            renderInput={(params) => <TextField {...params} label="Incharge" size="small" />}
          />
          <Autocomplete
            options={teachers}
            getOptionLabel={(t) => t.full_name}
            value={assistantTeacher}
            onChange={(_, t) => set("assistant_incharge_id", t?.id ?? null)}
            renderInput={(params) => <TextField {...params} label="Assistant Incharge" size="small" />}
          />
          <TextField
            label="Class Name *"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            size="small"
            placeholder="e.g. Nursery, One, Grade 6"
          />
          <TextField
            label="Class Fee"
            value={form.class_fee}
            onChange={(e) => set("class_fee", e.target.value)}
            size="small"
            type="number"
            placeholder="e.g. 6000"
            slotProps={{ input: { inputProps: { min: 0 } } }}
          />

          {/* Row 2: Academic Year, Level Order, Capacity */}
          <TextField
            select
            label="Academic Year *"
            value={form.academic_year_id}
            onChange={(e) => set("academic_year_id", e.target.value)}
            size="small"
            disabled={!!editing}
          >
            {years.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.name}{y.is_active ? " (current)" : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Level Order *"
            value={form.level_order}
            onChange={(e) => set("level_order", e.target.value)}
            size="small"
            type="number"
            placeholder="e.g. 1, 2, 3"
            slotProps={{ input: { inputProps: { min: 0 } } }}
          />
          <TextField
            label="Total Capacity (Intake Limit)"
            value={form.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            size="small"
            type="number"
            placeholder="No limit"
            slotProps={{ input: { inputProps: { min: 0 } } }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Close</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          sx={{ bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d" }, px: 4 }}
        >
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Delete Dialog ───────────────────────────────────────────────────────────

function DeleteDialog({
  open,
  label,
  onClose,
  onConfirm,
  isPending,
  error,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Class</DialogTitle>
      <DialogContent>
        <Typography>
          Delete class <strong>{label}</strong>? All its sections and subjects will also be removed.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={onConfirm} disabled={isPending}>
          {isPending ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ClassesPage() {
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({ queryKey: ["classes-overview"], queryFn: getClassesOverview });
  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const teachersQuery = useQuery({ queryKey: ["teachers"], queryFn: () => listTeachers() });

  const classes = overviewQuery.data ?? [];
  const years = yearsQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];

  const activeYear = years.find((y) => y.is_active);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addDialog, setAddDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<ClassOverview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassOverview | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const effectiveYear = yearFilter ?? activeYear?.id ?? ALL;

  const filtered = classes.filter((c) => {
    if (effectiveYear !== ALL) {
      if (c.academic_year_id !== effectiveYear) {
        const yr = years.find((y) => y.id === effectiveYear);
        if (!yr || c.academic_year !== yr.name) return false;
      }
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.academic_year.toLowerCase().includes(q);
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["classes-overview"] });

  const saved = (msg: string) => {
    setAddDialog(false);
    setEditTarget(null);
    setToast(msg);
    refresh();
  };

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onSuccess: () => {
      setDeleteTarget(null);
      setToast("Class deleted");
      refresh();
    },
    onError: (err) => setDeleteError(apiErrorMessage(err, "Could not delete class.")),
  });

  const loading = overviewQuery.isLoading;

  // Summary stats
  const totalStudents = filtered.reduce((s, c) => s + c.student_count, 0);
  const totalFee = filtered.reduce((s, c) => s + (c.class_fee ?? 0) * c.student_count, 0);

  return (
    <AppShell title="Class List" navItems={adminNavItems}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Class List</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage all classes, fees and assignments
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddDialog(true)}
          sx={{ bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d" } }}
        >
          Add Class
        </Button>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip icon={<ClassIcon />} label={`${filtered.length} class${filtered.length !== 1 ? "es" : ""}`} size="small" />
        <Chip icon={<GroupsIcon />} label={`${totalStudents} students`} size="small" color="primary" variant="outlined" />
        {totalFee > 0 && (
          <Chip label={`Total fee: ${fmt(totalFee)}`} size="small" color="success" variant="outlined" />
        )}
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            placeholder="Search class name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label="Academic Year"
            value={effectiveYear}
            onChange={(e) => setYearFilter(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value={ALL}>All Years</MenuItem>
            {years.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.name}{y.is_active ? " (current)" : ""}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {/* Table */}
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      {overviewQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(overviewQuery.error, "Could not load classes.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell sx={{ color: "#fff", fontWeight: 600, width: 50 }}>#</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Class Name</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Incharge</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">Class Fee</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="center">Students</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="center">Sections</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="center">Subjects</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">Total Fee</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="center">Capacity</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  {classes.length === 0
                    ? "No classes yet. Click \"Add Class\" to get started."
                    : "No classes match the current search or filter."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c, i) => {
              const totalFeeRow = (c.class_fee ?? 0) * c.student_count;
              const capacityUsed = c.capacity ? Math.round((c.student_count / c.capacity) * 100) : null;
              return (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ color: "text.secondary" }}>{i + 1}</TableCell>
                  <TableCell>
                    <Typography
                      fontWeight={700}
                      color="primary.main"
                      sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                    >
                      {c.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.academic_year}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {c.incharge_name ? (
                      <Typography variant="body2">{c.incharge_name}</Typography>
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {c.class_fee != null ? (
                      <Typography fontWeight={600}>{fmt(c.class_fee)}</Typography>
                    ) : (
                      <Typography color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={c.student_count}
                      size="small"
                      color={c.student_count > 0 ? "primary" : "default"}
                      variant={c.student_count > 0 ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={c.sections.length} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={c.subjects.length} size="small" variant="outlined" color="secondary" />
                  </TableCell>
                  <TableCell align="right">
                    {totalFeeRow > 0 ? (
                      <Typography fontWeight={600} color="success.main">{fmt(totalFeeRow)}</Typography>
                    ) : (
                      <Typography color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {c.capacity != null ? (
                      <Tooltip title={`${c.student_count} / ${c.capacity} (${capacityUsed}%)`}>
                        <Chip
                          label={`${c.student_count}/${c.capacity}`}
                          size="small"
                          color={capacityUsed != null && capacityUsed >= 90 ? "error" : capacityUsed != null && capacityUsed >= 70 ? "warning" : "success"}
                          variant="outlined"
                        />
                      </Tooltip>
                    ) : (
                      <Typography color="text.disabled" variant="body2">No limit</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditTarget(c)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => { setDeleteError(null); setDeleteTarget(c); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialogs */}
      {(addDialog || editTarget) && (
        <ClassDialog
          open
          editing={editTarget}
          years={years}
          teachers={teachers}
          onClose={() => { setAddDialog(false); setEditTarget(null); }}
          onSaved={saved}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          open
          label={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => removeMutation.mutate(deleteTarget.id)}
          isPending={removeMutation.isPending}
          error={deleteError}
        />
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast}
      />
    </AppShell>
  );
}
