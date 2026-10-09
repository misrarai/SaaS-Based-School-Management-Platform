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
  createVehicle,
  deleteVehicle,
  listDrivers,
  listVehicles,
  updateVehicle,
  type TransportVehicle,
  type VehiclePayload,
  type VehicleType,
} from "../../../api/transport";
import { adminNavWithTransportHostel } from "../../transportHostelNav";
import { PageHeader, fmtDate, orNull, todayIso } from "../../transportHostelUi";

const EMPTY = {
  registration_number: "",
  vehicle_type: "bus" as VehicleType,
  capacity: "",
  model: "",
  insurance_expiry: "",
  fitness_expiry: "",
  driver_id: "",
  conductor_name: "",
  conductor_phone: "",
  status: "active" as TransportVehicle["status"],
};

function expiryChip(value: string | null) {
  if (!value) return <Typography variant="body2">—</Typography>;
  const expired = value < todayIso();
  const soon = !expired && new Date(value).getTime() - Date.now() < 30 * 86400000;
  return (
    <Chip
      size="small"
      label={fmtDate(value)}
      color={expired ? "error" : soon ? "warning" : "default"}
      variant={expired || soon ? "filled" : "outlined"}
    />
  );
}

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const vehicles = useQuery({ queryKey: ["transport", "vehicles"], queryFn: listVehicles });
  const drivers = useQuery({ queryKey: ["transport", "drivers"], queryFn: listDrivers });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransportVehicle | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  function openDialog(v: TransportVehicle | null) {
    setEditing(v);
    setError(null);
    setForm(
      v
        ? {
            registration_number: v.registration_number,
            vehicle_type: v.vehicle_type,
            capacity: String(v.capacity),
            model: v.model ?? "",
            insurance_expiry: v.insurance_expiry ?? "",
            fitness_expiry: v.fitness_expiry ?? "",
            driver_id: v.driver_id ?? "",
            conductor_name: v.conductor_name ?? "",
            conductor_phone: v.conductor_phone ?? "",
            status: v.status,
          }
        : EMPTY,
    );
    setOpen(true);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transport"] });

  const save = useMutation({
    mutationFn: () => {
      const payload: VehiclePayload = {
        registration_number: form.registration_number.trim(),
        vehicle_type: form.vehicle_type,
        capacity: Number(form.capacity),
        model: orNull(form.model),
        insurance_expiry: form.insurance_expiry || null,
        fitness_expiry: form.fitness_expiry || null,
        driver_id: form.driver_id || null,
        conductor_name: orNull(form.conductor_name),
        conductor_phone: orNull(form.conductor_phone),
      };
      return editing ? updateVehicle(editing.id, { ...payload, status: form.status }) : createVehicle(payload);
    },
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save vehicle.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(apiErrorMessage(err, "Could not delete vehicle.")),
  });

  return (
    <AppShell title="Transport" navItems={adminNavWithTransportHostel()}>
      <PageHeader
        title="Vehicles"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog(null)}>
            Add vehicle
          </Button>
        }
      />

      {vehicles.isLoading && <Typography>Loading…</Typography>}
      {vehicles.data?.length === 0 && <Alert severity="info">No vehicles yet — add your first bus or van.</Alert>}

      {!!vehicles.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Reg. No.</TableCell>
                <TableCell>Type / Model</TableCell>
                <TableCell>Seats</TableCell>
                <TableCell>Driver</TableCell>
                <TableCell>Conductor</TableCell>
                <TableCell>Insurance</TableCell>
                <TableCell>Fitness</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicles.data.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{v.registration_number}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>
                    {v.vehicle_type}
                    {v.model ? ` · ${v.model}` : ""}
                  </TableCell>
                  <TableCell>
                    {v.allocated_count}/{v.capacity}
                  </TableCell>
                  <TableCell>
                    {v.driver_name ?? "—"}
                    {v.driver_phone && (
                      <Typography variant="caption" sx={{ display: "block" }} color="text.secondary">
                        {v.driver_phone}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{v.conductor_name ?? "—"}</TableCell>
                  <TableCell>{expiryChip(v.insurance_expiry)}</TableCell>
                  <TableCell>{expiryChip(v.fitness_expiry)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={v.status} color={v.status === "active" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openDialog(v)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => window.confirm(`Delete vehicle ${v.registration_number}?`) && remove.mutate(v.id)}
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

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit vehicle" : "Add a vehicle"}</DialogTitle>
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
                <TextField label="Registration number" value={form.registration_number} onChange={set("registration_number")} required fullWidth autoFocus />
                <TextField select label="Type" value={form.vehicle_type} onChange={set("vehicle_type")} fullWidth>
                  <MenuItem value="bus">Bus</MenuItem>
                  <MenuItem value="van">Van</MenuItem>
                  <MenuItem value="car">Car</MenuItem>
                </TextField>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Seating capacity" type="number" value={form.capacity} onChange={set("capacity")} required fullWidth />
                <TextField label="Model / make" value={form.model} onChange={set("model")} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Insurance expiry" type="date" value={form.insurance_expiry} onChange={set("insurance_expiry")} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Fitness expiry" type="date" value={form.fitness_expiry} onChange={set("fitness_expiry")} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <TextField select label="Driver" value={form.driver_id} onChange={set("driver_id")} fullWidth>
                <MenuItem value="">— None —</MenuItem>
                {drivers.data?.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.full_name} {d.phone ? `(${d.phone})` : ""}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Conductor / helper name" value={form.conductor_name} onChange={set("conductor_name")} fullWidth />
                <TextField label="Conductor phone" value={form.conductor_phone} onChange={set("conductor_phone")} fullWidth />
              </Stack>
              {editing && (
                <TextField select label="Status" value={form.status} onChange={set("status")} fullWidth>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </TextField>
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
