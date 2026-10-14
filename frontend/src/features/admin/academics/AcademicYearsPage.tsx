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
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import UpgradeIcon from "@mui/icons-material/Upgrade";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  activateAcademicYear,
  createAcademicYear,
  deactivateAcademicYear,
  listAcademicYears,
  promoteStudents,
  updateAcademicYear,
  type AcademicYear,
  type PromoteStudentsResult,
} from "../../../api/academicYears";
import { apiErrorMessage } from "../../../lib/apiError";

// ── Shared date validation ────────────────────────────────────────────────────

function validateDates(start: string, end: string): string | null {
  if (!start || !end) return "Start date and end date are required.";
  if (new Date(end) <= new Date(start)) return "End date must be later than start date.";
  return null;
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createAcademicYear({ name: name.trim(), start_date: start, end_date: end, is_active: makeCurrent }),
    onSuccess: () => {
      setName(""); setStart(""); setEnd(""); setMakeCurrent(false); setLocalError(null);
      onCreated();
    },
    onError: () => setLocalError(null),
  });

  function handleSubmit() {
    const err = validateDates(start, end);
    if (err) { setLocalError(err); return; }
    if (!name.trim()) { setLocalError("Name is required."); return; }
    setLocalError(null);
    create.mutate();
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
        Add Academic Year
      </Typography>
      <Stack spacing={2}>
        <TextField
          label="Name"
          placeholder="2026-2027"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          required
          fullWidth
        />
        <Stack direction="row" spacing={2}>
          <TextField
            label="Start date"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            size="small"
            fullWidth
            required
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="End date"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            size="small"
            fullWidth
            required
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <TextField
          select
          label="Set as current session?"
          value={makeCurrent ? "yes" : "no"}
          onChange={(e) => setMakeCurrent(e.target.value === "yes")}
          size="small"
          fullWidth
        >
          <MenuItem value="no">No — create as inactive</MenuItem>
          <MenuItem value="yes">Yes — activate immediately</MenuItem>
        </TextField>

        {(localError || create.isError) && (
          <Alert severity="error">{localError ?? apiErrorMessage(create.error, "Could not create academic year.")}</Alert>
        )}
        {create.isSuccess && <Alert severity="success">Academic year created successfully.</Alert>}

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={create.isPending}
          onClick={handleSubmit}
          fullWidth
        >
          {create.isPending ? "Creating…" : "Create Academic Year"}
        </Button>
      </Stack>
    </Paper>
  );
}

// ── Edit Dialog ───────────────────────────────────────────────────────────────

function EditDialog({ year, onClose }: { year: AcademicYear; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(year.name);
  const [start, setStart] = useState(year.start_date);
  const [end, setEnd] = useState(year.end_date);
  const [localError, setLocalError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => updateAcademicYear(year.id, { name: name.trim(), start_date: start, end_date: end }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years"] }); onClose(); },
  });

  function handleSave() {
    const err = validateDates(start, end);
    if (err) { setLocalError(err); return; }
    if (!name.trim()) { setLocalError("Name is required."); return; }
    setLocalError(null);
    save.mutate();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit — {year.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            required
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Start date"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End date"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
          {(localError || save.isError) && (
            <Alert severity="error">{localError ?? apiErrorMessage(save.error, "Could not update.")}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Activate Confirm Dialog ───────────────────────────────────────────────────

function ActivateDialog({ year, onClose }: { year: AcademicYear; onClose: () => void }) {
  const qc = useQueryClient();
  const activate = useMutation({
    mutationFn: () => activateAcademicYear(year.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years"] }); onClose(); },
  });
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Activate {year.name}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This will set <strong>{year.name}</strong> as the current active session and deactivate any previously active academic year for this school.
        </DialogContentText>
        {activate.isError && <Alert severity="error" sx={{ mt: 1 }}>{apiErrorMessage(activate.error)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="success" onClick={() => activate.mutate()} disabled={activate.isPending}>
          {activate.isPending ? "Activating…" : "Activate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Deactivate Confirm Dialog ─────────────────────────────────────────────────

function DeactivateDialog({ year, onClose }: { year: AcademicYear; onClose: () => void }) {
  const qc = useQueryClient();
  const deactivate = useMutation({
    mutationFn: () => deactivateAcademicYear(year.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years"] }); onClose(); },
  });
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Deactivate {year.name}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          <strong>{year.name}</strong> will be set to inactive. No other year will be automatically activated. You can re-activate it later.
        </DialogContentText>
        {deactivate.isError && <Alert severity="error" sx={{ mt: 1 }}>{apiErrorMessage(deactivate.error)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="warning" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>
          {deactivate.isPending ? "Deactivating…" : "Deactivate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AcademicYearsPage() {
  const qc = useQueryClient();
  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const years = yearsQuery.data ?? [];

  const [editTarget, setEditTarget] = useState<AcademicYear | null>(null);
  const [activateTarget, setActivateTarget] = useState<AcademicYear | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AcademicYear | null>(null);

  // Promote students state
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [promoteResult, setPromoteResult] = useState<PromoteStudentsResult | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["academic-years"] });

  const promote = useMutation({
    mutationFn: () => promoteStudents(fromId, toId),
    onSuccess: (data) => {
      setPromoteResult(data);
      setConfirmPromote(false);
      refresh();
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => setConfirmPromote(false),
  });

  const nameOf = (id: string) => years.find((y) => y.id === id)?.name ?? "";

  return (
    <AppShell title="Academic Years" navItems={adminNavItems}>
      <Grid container spacing={2}>
        {/* ── Left: Table ── */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            {yearsQuery.isLoading && <LinearProgress />}
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Session</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {years.map((y) => (
                  <TableRow
                    key={y.id}
                    hover
                    sx={y.is_active ? { bgcolor: "#f0fdf4" } : undefined}
                  >
                    <TableCell>
                      <Typography fontWeight={y.is_active ? 700 : 500}>{y.name}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{y.start_date}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{y.end_date}</TableCell>
                    <TableCell>
                      {y.is_active ? (
                        <Chip size="small" color="success" label="Active" icon={<CheckCircleIcon />} />
                      ) : (
                        <Chip size="small" label="Inactive" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setEditTarget(y)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {y.is_active ? (
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            startIcon={<PauseCircleIcon fontSize="small" />}
                            onClick={() => setDeactivateTarget(y)}
                            sx={{ fontSize: 12 }}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            color="success"
                            variant="outlined"
                            startIcon={<CheckCircleIcon fontSize="small" />}
                            onClick={() => setActivateTarget(y)}
                            sx={{ fontSize: 12 }}
                          >
                            Activate
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!yearsQuery.isLoading && years.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                      <Box>
                        <Typography variant="body1" sx={{ mb: 0.5 }}>No academic years yet.</Typography>
                        <Typography variant="body2">Use the form on the right to create your first session.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        {/* ── Right: Forms ── */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2}>
            <CreateForm onCreated={refresh} />

            {/* Promote students */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                Promote Students
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Move every active student to the next class (by level order) in the target year. Final-class students are graduated.
              </Typography>
              <Stack spacing={2}>
                <TextField select label="From year" value={fromId} onChange={(e) => setFromId(e.target.value)} size="small" fullWidth>
                  {years.map((y) => <MenuItem key={y.id} value={y.id}>{y.name}</MenuItem>)}
                </TextField>
                <TextField select label="To year" value={toId} onChange={(e) => setToId(e.target.value)} size="small" fullWidth>
                  {years.filter((y) => y.id !== fromId).map((y) => <MenuItem key={y.id} value={y.id}>{y.name}</MenuItem>)}
                </TextField>
                {promote.isError && <Alert severity="error">{apiErrorMessage(promote.error, "Promotion failed.")}</Alert>}
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<UpgradeIcon />}
                  disabled={!fromId || !toId || fromId === toId || promote.isPending}
                  onClick={() => setConfirmPromote(true)}
                  fullWidth
                >
                  Promote Students
                </Button>
                {promoteResult && (
                  <Alert severity="success" onClose={() => setPromoteResult(null)}>
                    {promoteResult.students_promoted} promoted, {promoteResult.students_graduated} graduated.
                    {promoteResult.promoted_by_class.length > 0 && (
                      <List dense disablePadding>
                        {promoteResult.promoted_by_class.map((r) => (
                          <ListItem key={r.class_name} disableGutters>
                            <ListItemText primary={`${r.class_name}: ${r.students_moved} moved`} />
                          </ListItem>
                        ))}
                      </List>
                    )}
                    {promoteResult.graduated_classes.length > 0 && (
                      <div>Graduated from: {promoteResult.graduated_classes.join(", ")}</div>
                    )}
                  </Alert>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {/* ── Dialogs ── */}
      {editTarget && <EditDialog year={editTarget} onClose={() => setEditTarget(null)} />}
      {activateTarget && <ActivateDialog year={activateTarget} onClose={() => setActivateTarget(null)} />}
      {deactivateTarget && <DeactivateDialog year={deactivateTarget} onClose={() => setDeactivateTarget(null)} />}

      <Dialog open={confirmPromote} onClose={() => setConfirmPromote(false)}>
        <DialogTitle>Promote all students?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Promote students from <b>{nameOf(fromId)}</b> to <b>{nameOf(toId)}</b>. This changes every active student's class and cannot be undone automatically.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPromote(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={() => promote.mutate()} disabled={promote.isPending}>
            {promote.isPending ? "Promoting…" : "Promote"}
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
