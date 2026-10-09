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
import {
  addStop,
  createRoute,
  deleteRoute,
  deleteStop,
  listRoutes,
  listVehicles,
  updateRoute,
  updateStop,
  type TransportRoute,
  type TransportStop,
} from "../../../api/transport";
import { adminNavWithTransportHostel } from "../../transportHostelNav";
import { PageHeader, fmtMoney, orNull } from "../../transportHostelUi";

const EMPTY_ROUTE = { name: "", code: "", vehicle_id: "", start_point: "", description: "", status: "active" as TransportRoute["status"] };
const EMPTY_STOP = { name: "", stop_order: "1", pickup_time: "", drop_time: "", monthly_fare: "" };

function RouteDialog({ route, open, onClose }: { route: TransportRoute | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const vehicles = useQuery({ queryKey: ["transport", "vehicles"], queryFn: listVehicles, enabled: open });
  const [form, setForm] = useState(EMPTY_ROUTE);
  const [error, setError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = `${open}-${route?.id ?? "new"}`;
  if (key !== lastKey) {
    setLastKey(key);
    setError(null);
    setForm(
      route
        ? {
            name: route.name,
            code: route.code ?? "",
            vehicle_id: route.vehicle_id ?? "",
            start_point: route.start_point ?? "",
            description: route.description ?? "",
            status: route.status,
          }
        : EMPTY_ROUTE,
    );
  }
  const set = (k: keyof typeof EMPTY_ROUTE) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        code: orNull(form.code),
        vehicle_id: form.vehicle_id || null,
        start_point: orNull(form.start_point),
        description: orNull(form.description),
      };
      return route ? updateRoute(route.id, { ...payload, status: form.status }) : createRoute(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport"] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save route.")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{route ? "Edit route" : "Add a route"}</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Route name" value={form.name} onChange={set("name")} required fullWidth autoFocus />
              <TextField label="Code" value={form.code} onChange={set("code")} sx={{ minWidth: 140 }} />
            </Stack>
            <TextField select label="Vehicle" value={form.vehicle_id} onChange={set("vehicle_id")} fullWidth>
              <MenuItem value="">— Not assigned —</MenuItem>
              {vehicles.data?.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  {v.registration_number} · {v.vehicle_type} · {v.allocated_count}/{v.capacity} seats used
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Start point" value={form.start_point} onChange={set("start_point")} fullWidth />
            <TextField label="Description" value={form.description} onChange={set("description")} fullWidth multiline minRows={2} />
            {route && (
              <TextField select label="Status" value={form.status} onChange={set("status")} fullWidth>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            {route ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function StopDialog({
  routeId,
  stop,
  nextOrder,
  onClose,
}: {
  routeId: string | null;
  stop: TransportStop | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const open = routeId !== null;
  const [form, setForm] = useState(EMPTY_STOP);
  const [error, setError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = `${routeId}-${stop?.id ?? "new"}`;
  if (key !== lastKey) {
    setLastKey(key);
    setError(null);
    setForm(
      stop
        ? {
            name: stop.name,
            stop_order: String(stop.stop_order),
            pickup_time: stop.pickup_time ?? "",
            drop_time: stop.drop_time ?? "",
            monthly_fare: String(stop.monthly_fare),
          }
        : { ...EMPTY_STOP, stop_order: String(nextOrder) },
    );
  }
  const set = (k: keyof typeof EMPTY_STOP) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        stop_order: Number(form.stop_order) || 0,
        pickup_time: form.pickup_time || null,
        drop_time: form.drop_time || null,
        monthly_fare: Number(form.monthly_fare) || 0,
      };
      return stop ? updateStop(stop.id, payload) : addStop(routeId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transport"] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save stop.")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{stop ? "Edit stop" : "Add a stop"}</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <TextField label="Stop name" value={form.name} onChange={set("name")} required fullWidth autoFocus />
            <TextField label="Order" type="number" value={form.stop_order} onChange={set("stop_order")} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField label="Pickup time" type="time" value={form.pickup_time} onChange={set("pickup_time")} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="Drop time" type="time" value={form.drop_time} onChange={set("drop_time")} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <TextField label="Monthly fare (Rs)" type="number" value={form.monthly_fare} onChange={set("monthly_fare")} required fullWidth />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function RoutesPage() {
  const queryClient = useQueryClient();
  const routes = useQuery({ queryKey: ["transport", "routes"], queryFn: listRoutes });
  const [routeDialog, setRouteDialog] = useState<{ open: boolean; route: TransportRoute | null }>({ open: false, route: null });
  const [stopDialog, setStopDialog] = useState<{ routeId: string | null; stop: TransportStop | null; nextOrder: number }>({
    routeId: null,
    stop: null,
    nextOrder: 1,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transport"] });
  const onError = (err: unknown) => window.alert(apiErrorMessage(err, "Could not delete."));
  const removeRoute = useMutation({ mutationFn: (id: string) => deleteRoute(id), onSuccess: invalidate, onError });
  const removeStop = useMutation({ mutationFn: (id: string) => deleteStop(id), onSuccess: invalidate, onError });

  return (
    <AppShell title="Transport" navItems={adminNavWithTransportHostel()}>
      <PageHeader
        title="Routes & Stops"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRouteDialog({ open: true, route: null })}>
            Add route
          </Button>
        }
      />

      {routes.isLoading && <Typography>Loading…</Typography>}
      {routes.data?.length === 0 && <Alert severity="info">No routes yet — add a route, then its stops and fares.</Alert>}

      <Stack spacing={2}>
        {routes.data?.map((r) => (
          <Paper key={r.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
              <Box>
                <Typography variant="h6">
                  {r.name} {r.code && <Chip size="small" label={r.code} sx={{ ml: 1 }} />}
                  {r.status !== "active" && <Chip size="small" label={r.status} sx={{ ml: 1 }} />}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vehicle: {r.vehicle_registration ?? "not assigned"}
                  {r.vehicle_capacity != null && ` · ${r.allocated_count} student(s) on route`}
                  {r.start_point && ` · Starts at ${r.start_point}`}
                </Typography>
                {r.description && (
                  <Typography variant="body2" color="text.secondary">
                    {r.description}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    setStopDialog({
                      routeId: r.id,
                      stop: null,
                      nextOrder: Math.max(0, ...r.stops.map((s) => s.stop_order)) + 1,
                    })
                  }
                >
                  Stop
                </Button>
                <Button size="small" onClick={() => setRouteDialog({ open: true, route: r })}>
                  Edit
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => window.confirm(`Delete route ${r.name} and its stops?`) && removeRoute.mutate(r.id)}
                >
                  Delete
                </Button>
              </Stack>
            </Stack>
            {r.stops.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No stops added yet.
              </Typography>
            ) : (
              <TableContainer sx={{ borderRadius: 1, border: "1px solid #e0e0e0" }}>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Stop</TableCell>
                      <TableCell>Pickup</TableCell>
                      <TableCell>Drop</TableCell>
                      <TableCell>Monthly fare</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {r.stops.map((s) => (
                      <TableRow key={s.id} hover>
                        <TableCell>{s.stop_order}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.pickup_time ?? "—"}</TableCell>
                        <TableCell>{s.drop_time ?? "—"}</TableCell>
                        <TableCell>{fmtMoney(s.monthly_fare)}</TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => setStopDialog({ routeId: r.id, stop: s, nextOrder: s.stop_order })}>
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => window.confirm(`Delete stop ${s.name}?`) && removeStop.mutate(s.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        ))}
      </Stack>

      <RouteDialog
        open={routeDialog.open}
        route={routeDialog.route}
        onClose={() => setRouteDialog({ open: false, route: null })}
      />
      <StopDialog
        routeId={stopDialog.routeId}
        stop={stopDialog.stop}
        nextOrder={stopDialog.nextOrder}
        onClose={() => setStopDialog({ routeId: null, stop: null, nextOrder: 1 })}
      />
    </AppShell>
  );
}
