import { useMemo, useState } from "react";
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
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { apiErrorMessage } from "../../../lib/apiError";
import { listStudents, type Student } from "../../../api/students";
import {
  createTransportAllocation,
  endTransportAllocation,
  listRoutes,
  listTransportAllocations,
  type PickupType,
} from "../../../api/transport";
import { adminNavWithTransportHostel } from "../../transportHostelNav";
import { PageHeader, TabButtons, fmtDate, fmtMoney, orNull, todayIso } from "../../transportHostelUi";

type StatusFilter = "active" | "inactive" | "all";
const PICKUP_LABELS: Record<PickupType, string> = { both: "Pickup & drop", pickup: "Pickup only", drop: "Drop only" };

export function TransportAllocationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("active");
  const [routeFilter, setRouteFilter] = useState("");
  const routes = useQuery({ queryKey: ["transport", "routes"], queryFn: listRoutes });
  const allocations = useQuery({
    queryKey: ["transport", "allocations", status, routeFilter],
    queryFn: () => listTransportAllocations({ status, routeId: routeFilter || undefined }),
  });

  const [open, setOpen] = useState(false);
  const students = useQuery({
    queryKey: ["students", "active-for-transport"],
    queryFn: () => listStudents({ status: "active" }),
    enabled: open,
  });
  const [student, setStudent] = useState<Student | null>(null);
  const [routeId, setRouteId] = useState("");
  const [stopId, setStopId] = useState("");
  const [pickupType, setPickupType] = useState<PickupType>("both");
  const [startDate, setStartDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedRoute = useMemo(() => routes.data?.find((r) => r.id === routeId), [routes.data, routeId]);

  function openDialog() {
    setStudent(null);
    setRouteId("");
    setStopId("");
    setPickupType("both");
    setStartDate(todayIso());
    setNotes("");
    setError(null);
    setOpen(true);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transport"] });

  const create = useMutation({
    mutationFn: () =>
      createTransportAllocation({
        student_id: student!.id,
        route_id: routeId,
        stop_id: stopId,
        pickup_type: pickupType,
        start_date: startDate,
        notes: orNull(notes),
      }),
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not allocate transport.")),
  });

  const end = useMutation({
    mutationFn: (id: string) => endTransportAllocation(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(apiErrorMessage(err, "Could not end allocation.")),
  });

  return (
    <AppShell title="Transport" navItems={adminNavWithTransportHostel()}>
      <PageHeader
        title="Student Transport Allocation"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>
            Allocate student
          </Button>
        }
      />
      <TabButtons<StatusFilter>
        value={status}
        onChange={setStatus}
        options={[
          { value: "active", label: "Active" },
          { value: "inactive", label: "Ended" },
          { value: "all", label: "All" },
        ]}
      />
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <TextField select size="small" label="Route" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} sx={{ minWidth: 240 }}>
            <MenuItem value="">All routes</MenuItem>
            {routes.data?.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            <strong>{allocations.data?.length ?? 0}</strong> student(s) in this view
          </Typography>
        </Stack>
      </Paper>

      {allocations.isLoading && <Typography>Loading…</Typography>}
      {allocations.data?.length === 0 && <Alert severity="info">No allocations in this view.</Alert>}

      {!!allocations.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Route</TableCell>
                <TableCell>Stop</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Fare</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allocations.data.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{a.student_name ?? "—"}</TableCell>
                  <TableCell>{a.route_name}</TableCell>
                  <TableCell>{a.stop_name}</TableCell>
                  <TableCell>{PICKUP_LABELS[a.pickup_type]}</TableCell>
                  <TableCell>{fmtMoney(a.monthly_fare)}</TableCell>
                  <TableCell>{fmtDate(a.start_date)}</TableCell>
                  <TableCell>{fmtDate(a.end_date)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={a.status} color={a.status === "active" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">
                    {a.status === "active" && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => window.confirm(`End transport for ${a.student_name}?`) && end.mutate(a.id)}
                      >
                        End
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Allocate transport</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!student) {
              setError("Select a student.");
              return;
            }
            create.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <Autocomplete
                options={students.data ?? []}
                loading={students.isLoading}
                value={student}
                onChange={(_, v) => setStudent(v)}
                getOptionLabel={(s) => `${s.full_name}${s.admission_number ? ` (#${s.admission_number})` : ""}`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => <TextField {...params} label="Student" required />}
              />
              <TextField
                select
                label="Route"
                value={routeId}
                onChange={(e) => {
                  setRouteId(e.target.value);
                  setStopId("");
                }}
                required
                fullWidth
              >
                {routes.data
                  ?.filter((r) => r.status === "active")
                  .map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {r.name}
                      {r.vehicle_capacity != null ? ` · ${r.vehicle_registration}` : " · no vehicle"}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField select label="Stop" value={stopId} onChange={(e) => setStopId(e.target.value)} required fullWidth disabled={!selectedRoute}>
                {selectedRoute?.stops.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name} · pickup {s.pickup_time ?? "—"} · {fmtMoney(s.monthly_fare)}/month
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField select label="Service" value={pickupType} onChange={(e) => setPickupType(e.target.value as PickupType)} fullWidth>
                  {(Object.keys(PICKUP_LABELS) as PickupType[]).map((k) => (
                    <MenuItem key={k} value={k}>
                      {PICKUP_LABELS[k]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>
              Allocate
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
