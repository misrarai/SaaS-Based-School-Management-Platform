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
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { adminNavItems } from "../adminNav";
import {
  createSubject,
  deleteSubject,
  getClassesOverview,
  listAllSubjects,
  updateSubject,
  type ClassOverview,
  type SubjectWithClass,
} from "../../../api/classes";
import { listAcademicYears } from "../../../api/academicYears";
import { apiErrorMessage } from "../../../lib/apiError";

const ALL = "all";

// ─── Subject Dialog ──────────────────────────────────────────────────────────

function SubjectDialog({
  open,
  classes,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  classes: ClassOverview[];
  editing: SubjectWithClass | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [classId, setClassId] = useState(editing?.class_grade_id ?? "");
  const [error, setError] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) return updateSubject(editing.id, { name: name.trim(), code: code.trim() });
      return createSubject(classId, { name: name.trim(), code: code.trim() });
    },
    onSuccess: () => onSaved(editing ? "Subject updated" : "Subject created"),
    onError: (err) => setError(apiErrorMessage(err, "Could not save subject.")),
  });

  function handleSave() {
    if (!name.trim()) { setError("Subject name is required."); return; }
    if (!code.trim()) { setError("Subject code is required."); return; }
    if (!editing && !classId) { setError("Please select a class."); return; }
    setError("");
    saveMutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Edit Subject" : "Add Subject"}</DialogTitle>
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
            label="Subject Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. Mathematics, Physics"
          />
          <TextField
            label="Subject Code *"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. MATH-101, PHY-09"
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

// ─── Delete Confirm ──────────────────────────────────────────────────────────

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
      <DialogTitle>Delete Subject</DialogTitle>
      <DialogContent>
        <Typography>
          Delete <strong>{label}</strong>? This cannot be undone.
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

export function SubjectsPage() {
  const queryClient = useQueryClient();
  const subjectsQuery = useQuery({ queryKey: ["subjects-all"], queryFn: listAllSubjects });
  const overviewQuery = useQuery({ queryKey: ["classes-overview"], queryFn: getClassesOverview });
  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });

  const subjects = subjectsQuery.data ?? [];
  const classes = overviewQuery.data ?? [];
  const years = yearsQuery.data ?? [];

  const activeYear = years.find((y) => y.is_active);

  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  const [addDialog, setAddDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<SubjectWithClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectWithClass | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const effectiveYear = yearFilter ?? activeYear?.id ?? ALL;

  const filtered = subjects.filter((s) => {
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
      s.code.toLowerCase().includes(q) ||
      s.class_name.toLowerCase().includes(q)
    );
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["subjects-all"] });
    queryClient.invalidateQueries({ queryKey: ["classes-overview"] });
  };

  const saved = (msg: string) => {
    setAddDialog(false);
    setEditTarget(null);
    setToast(msg);
    refresh();
  };

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () => {
      setDeleteTarget(null);
      setToast("Subject deleted");
      refresh();
    },
    onError: (err) => setDeleteError(apiErrorMessage(err, "Could not delete subject.")),
  });

  const loading = subjectsQuery.isLoading || overviewQuery.isLoading;

  return (
    <AppShell title="Subjects" navItems={adminNavItems}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Subjects</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage subjects assigned to each class
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialog(true)}>
          Add Subject
        </Button>
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField
            size="small"
            placeholder="Search subject, code or class…"
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

      {/* Summary */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Chip
          icon={<MenuBookIcon />}
          label={`${filtered.length} subject${filtered.length !== 1 ? "s" : ""}`}
          size="small"
        />
      </Stack>

      {/* Table */}
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      {subjectsQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(subjectsQuery.error, "Could not load subjects.")}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>#</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Subject</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Code</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Class</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Academic Year</TableCell>
              <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {subjects.length === 0
                    ? "No subjects yet. Add subjects to your classes."
                    : "No subjects match the current filters."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s, i) => (
              <TableRow key={s.id} hover>
                <TableCell sx={{ color: "text.secondary" }}>{i + 1}</TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{s.name}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={s.code} size="small" variant="outlined" color="primary" />
                </TableCell>
                <TableCell>{s.class_name}</TableCell>
                <TableCell>
                  <Chip label={s.academic_year} size="small" variant="outlined" />
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
        <SubjectDialog
          open
          classes={classes}
          editing={editTarget}
          onClose={() => { setAddDialog(false); setEditTarget(null); }}
          onSaved={saved}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          open
          label={`${deleteTarget.name} (${deleteTarget.class_name})`}
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
