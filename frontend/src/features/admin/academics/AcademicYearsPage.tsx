import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
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
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import UpgradeIcon from "@mui/icons-material/Upgrade";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createAcademicYear,
  listAcademicYears,
  promoteStudents,
  updateAcademicYear,
  type PromoteStudentsResult,
} from "../../../api/academicYears";
import { apiErrorMessage } from "../../../lib/apiError";

export function AcademicYearsPage() {
  const qc = useQueryClient();
  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const years = yearsQuery.data ?? [];

  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(false);

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<PromoteStudentsResult | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["academic-years"] });

  const create = useMutation({
    mutationFn: () => createAcademicYear({ name: name.trim(), start_date: start, end_date: end, is_active: makeCurrent }),
    onSuccess: () => {
      setName("");
      setStart("");
      setEnd("");
      setMakeCurrent(false);
      refresh();
    },
  });
  const setCurrent = useMutation({
    mutationFn: (id: string) => updateAcademicYear(id, { is_active: true }),
    onSuccess: refresh,
  });
  const promote = useMutation({
    mutationFn: () => promoteStudents(fromId, toId),
    onSuccess: (data) => {
      setResult(data);
      setConfirmOpen(false);
      refresh();
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => setConfirmOpen(false),
  });

  const nameOf = (id: string) => years.find((y) => y.id === id)?.name ?? "";

  return (
    <AppShell title="Academic Years" navItems={adminNavItems}>
      <Grid container spacing={2}>
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
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {years.map((y) => (
                  <TableRow key={y.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{y.name}</TableCell>
                    <TableCell>{y.start_date}</TableCell>
                    <TableCell>{y.end_date}</TableCell>
                    <TableCell>
                      {y.is_active ? <Chip size="small" color="success" label="Current" /> : <Chip size="small" label="Inactive" />}
                    </TableCell>
                    <TableCell align="right">
                      {!y.is_active && (
                        <Button size="small" onClick={() => setCurrent.mutate(y.id)} disabled={setCurrent.isPending}>
                          Set as current
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!yearsQuery.isLoading && years.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No academic years yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {setCurrent.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {apiErrorMessage(setCurrent.error)}
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                New academic year
              </Typography>
              <Stack spacing={2}>
                <TextField label="Name" placeholder="2026-2027" value={name} onChange={(e) => setName(e.target.value)} size="small" required />
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
                <TextField
                  select
                  label="Make current?"
                  value={makeCurrent ? "yes" : "no"}
                  onChange={(e) => setMakeCurrent(e.target.value === "yes")}
                  size="small"
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes — set as the current session</MenuItem>
                </TextField>
                {create.isError && <Alert severity="error">{apiErrorMessage(create.error, "Could not create academic year.")}</Alert>}
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={!name.trim() || !start || !end || create.isPending}
                  onClick={() => create.mutate()}
                >
                  Create
                </Button>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                Promote students
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Moves every active student to the next class (by level order) in the target year. Students in the final
                class are graduated.
              </Typography>
              <Stack spacing={2}>
                <TextField select label="From year" value={fromId} onChange={(e) => setFromId(e.target.value)} size="small">
                  {years.map((y) => (
                    <MenuItem key={y.id} value={y.id}>
                      {y.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField select label="To year" value={toId} onChange={(e) => setToId(e.target.value)} size="small">
                  {years
                    .filter((y) => y.id !== fromId)
                    .map((y) => (
                      <MenuItem key={y.id} value={y.id}>
                        {y.name}
                      </MenuItem>
                    ))}
                </TextField>
                {promote.isError && <Alert severity="error">{apiErrorMessage(promote.error, "Promotion failed.")}</Alert>}
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<UpgradeIcon />}
                  disabled={!fromId || !toId || fromId === toId || promote.isPending}
                  onClick={() => setConfirmOpen(true)}
                >
                  Promote students
                </Button>
                {result && (
                  <Alert severity="success" onClose={() => setResult(null)}>
                    {result.students_promoted} promoted, {result.students_graduated} graduated.
                    {result.promoted_by_class.length > 0 && (
                      <List dense disablePadding>
                        {result.promoted_by_class.map((r) => (
                          <ListItem key={r.class_name} disableGutters>
                            <ListItemText primary={`${r.class_name}: ${r.students_moved} moved`} />
                          </ListItem>
                        ))}
                      </List>
                    )}
                    {result.graduated_classes.length > 0 && <div>Graduated from: {result.graduated_classes.join(", ")}</div>}
                  </Alert>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Promote all students?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Promote students from <b>{nameOf(fromId)}</b> to <b>{nameOf(toId)}</b>. This changes every active student's
            class and cannot be undone automatically.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={() => promote.mutate()} disabled={promote.isPending}>
            {promote.isPending ? "Promoting…" : "Promote"}
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
