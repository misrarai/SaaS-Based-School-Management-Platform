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
import GroupsIcon from "@mui/icons-material/GroupsOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { adminNavItems } from "../adminNav";
import {
  createSection,
  deleteSection,
  getClassesOverview,
  listAllSections,
  updateSection,
  type ClassOverview,
  type SectionWithClass,
} from "../../../api/classes";
import { listAcademicYears } from "../../../api/academicYears";
import { listTeachers, type Teacher } from "../../../api/teachers";
import { apiErrorMessage } from "../../../lib/apiError";

const ALL = "all";

// ─── Add/Edit Section Dialog ────────────────────────────────────────────────

function SectionDialog({
  open,
  classes,
  teachers,
  editing,
  defaultClassId,
  onClose,
  onSaved,
}: {
  open: boolean;
  classes: ClassOverview[];
  teachers: Teacher[];
  editing: SectionWithClass | null;
  defaultClassId?: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [classId, setClassId] = useState(editing?.class_grade_id ?? defaultClassId ?? "");
  const [teacherId, setTeacherId] = useState<string | null>(editing?.class_teacher_id ?? null);
  const [error, setError] = useState("");

  const selectedTeacher = teachers.find((t) => t.id === teacherId) ?? null;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        return updateSection(editing.id, {
          name: name.trim(),
          class_teacher_id: teacherId,
        });
      }
      return createSection(classId, name.trim(), teacherId);
    },
    onSuccess: () => {
      onSaved(editing ? "Section updated" : "Section created");
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save section.")),
  });

  function handleSave() {
    if (!name.trim()) { setError("Section name is required."); return; }
    if (!classId) { setError("Please select a class."); return; }
    setError("");
    saveMutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Edit Section" : "Add Section"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {!editing && (
            <TextField
              select
              label="Class *"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              fullWidth
              size="small"
            >
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} ({c.academic_year})
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Section Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. A, B, Rose, Blue"
          />
          <Autocomplete
            options={teachers}
            getOptionLabel={(t) => t.full_name}
            value={selectedTeacher}
            onChange={(_, t) => setTeacherId(t?.id ?? null)}
            renderInput={(params) => <TextField {...params} label="Class Teacher (optional)" size="small" />}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : editing ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Delete Confirm ─────────────────────────────────────────────────────────

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
      <DialogTitle>Delete Section</DialogTitle>
      <DialogContent>
        <Typography>
          Delete <strong>{label}</strong>? Students in this section will be unassigned.
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

export function SectionsPage() {
  const queryClient = useQueryClient();
  const sectionsQuery = useQuery({ queryKey: ["sections-all"], queryFn: listAllSections });
  const overviewQuery = useQuery({ queryKey: ["classes-overview"], queryFn: getClassesOverview });
  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const teachersQuery = useQuery({ queryKey: ["teachers"], queryFn: () => listTeachers() });

  const sections = sectionsQuery.data ?? [];
  const classes = overviewQuery.data ?? [];
  const years = yearsQuery.data ?? [];
  const teachers = teachersQuery.data ?? [];

  const activeYear = years.find((y) => y.is_active);

  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  const [addDialog, setAddDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<SectionWithClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SectionWithClass | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const effectiveYear = yearFilter ?? activeYear?.id ?? ALL;

  const filtered = sections.filter((s) => {
    if (effectiveYear !== ALL && effectiveYear) {
      const cls = classes.find((c) => c.id === s.class_grade_id);
      if (!cls) return false;
      if (cls.academic_year_id !== effectiveYear && cls.academic_year !== years.find((y) => y.id === effectiveYear)?.name)
        return false;
    }
    if (classFilter !== ALL && s.class_grade_id !== classFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.class_name.toLowerCase().includes(q) ||
      (s.class_teacher_name ?? "").toLowerCase().includes(q)
    );
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sections-all"] });
    queryClient.invalidateQueries({ queryKey: ["classes-overview"] });
  };

  const saved = (msg: string) => {
    setAddDialog(false);
    setEditTarget(null);
    setToast(msg);
    refresh();
  };

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteSection(id),
    onSuccess: () => {
      setDeleteTarget(null);
      setToast("Section deleted");
      refresh();
    },
    onError: (err) => setDeleteError(apiErrorMessage(err, "Could not delete section.")),
  });

  const loading = sectionsQuery.isLoading || overviewQuery.isLoading;

  return (
    <AppShell title="Sections" navItems={adminNavItems}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Sections</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage class sections and assign class teachers
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialog(true)}>
          Add Section
        </Button>
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField
            size="small"
            placeholder="Search section, class, teacher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
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
            sx={{ minWidth: 160 }}
          >
            <MenuItem value={ALL}>All Years</MenuItem>
            {years.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.name}{y.is_active ? " (current)" : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Class"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value={ALL}>All Classes</MenuItem>
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {/* Summary row */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Chip icon={<GroupsIcon />} label={`${filtered.length} section${filtered.length !== 1 ? "s" : ""}`} size="small" />
        <Chip
          icon={<PersonIcon />}
          label={`${filtered.filter((s) => s.class_teacher_id).length} with teacher`}
          size="small"
          color="success"
          variant="outlined"
        />
        {filtered.some((s) => !s.class_teacher_id) && (
          <Chip
            label={`${filtered.filter((s) => !s.class_teacher_id).length} unassigned`}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Stack>

      {/* Table */}
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      {sectionsQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(sectionsQuery.error, "Could not load sections.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>#</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Section</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Class</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Academic Year</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Class Teacher</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="center">Students</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {sections.length === 0 ? "No sections yet. Add a section to get started." : "No sections match the current filters."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s, i) => (
              <TableRow key={s.id} hover>
                <TableCell sx={{ color: "text.secondary" }}>{i + 1}</TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{s.name}</Typography>
                </TableCell>
                <TableCell>{s.class_name}</TableCell>
                <TableCell>
                  <Chip label={s.academic_year} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  {s.class_teacher_name ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <PersonIcon fontSize="small" color="action" />
                      <Typography variant="body2">{s.class_teacher_name}</Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="warning.main">Unassigned</Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={s.student_count}
                    size="small"
                    color={s.student_count > 0 ? "primary" : "default"}
                    variant={s.student_count > 0 ? "filled" : "outlined"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setEditTarget(s)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => { setDeleteError(null); setDeleteTarget(s); }}
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

      {/* Dialogs */}
      {(addDialog || editTarget) && (
        <SectionDialog
          open
          classes={classes}
          teachers={teachers}
          editing={editTarget}
          onClose={() => { setAddDialog(false); setEditTarget(null); }}
          onSaved={saved}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          open
          label={`${deleteTarget.class_name} — Section ${deleteTarget.name}`}
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
