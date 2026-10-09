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
import { listStaff } from "../../../api/staff";
import {
  createDriver,
  deleteDriver,
  listDrivers,
  updateDriver,
  type DriverPayload,
  type TransportDriver,
} from "../../../api/transport";
import { adminNavWithTransportHostel } from "../../transportHostelNav";
import { PageHeader, fmtDate, fmtMoney, orNull, todayIso } from "../../transportHostelUi";

const EMPTY = {
  full_name: "",
  phone: "",
  cnic: "",
  license_number: "",
  license_expiry: "",
  address: "",
  salary: "",
  staff_id: "",
  status: "active" as TransportDriver["status"],
};

export function DriversPage() {
  const queryClient = useQueryClient();
  const drivers = useQuery({ queryKey: ["transport", "drivers"], queryFn: listDrivers });
  const staff = useQuery({ queryKey: ["staff", "active", ""], queryFn: () => listStaff({ status: "active" }) });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransportDriver | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  function openDialog(d: TransportDriver | null) {
    setEditing(d);
    setError(null);
    setForm(
      d
        ? {
            full_name: d.full_name,
            phone: d.phone ?? "",
            cnic: d.cnic ?? "",
            license_number: d.license_number ?? "",
            license_expiry: d.license_expiry ?? "",
            address: d.address ?? "",
            salary: d.salary != null ? String(d.salary) : "",
            staff_id: d.staff_id ?? "",
            status: d.status,
          }
        : EMPTY,
    );
    setOpen(true);
  }

  function pickStaff(id: string) {
    const member = staff.data?.find((s) => s.id === id);
    setForm({
      ...form,
      staff_id: id,
      full_name: form.full_name || member?.full_name || "",
      phone: form.phone || member?.phone || "",
      salary: form.salary || (member?.salary != null ? String(member.salary) : ""),
    });
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["transport"] });

  const save = useMutation({
    mutationFn: () => {
      const payload: DriverPayload = {
        full_name: form.full_name.trim(),
        phone: orNull(form.phone),
        cnic: orNull(form.cnic),
        license_number: orNull(form.license_number),
        license_expiry: form.license_expiry || null,
        address: orNull(form.address),
        salary: form.salary ? Number(form.salary) : null,
        staff_id: form.staff_id || null,
      };
      return editing ? updateDriver(editing.id, { ...payload, status: form.status }) : createDriver(payload);
    },
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save driver.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDriver(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(apiErrorMessage(err, "Could not delete driver.")),
  });

  return (
    <AppShell title="Transport" navItems={adminNavWithTransportHostel()}>
      <PageHeader
        title="Drivers"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog(null)}>
            Add driver
          </Button>
        }
      />

      {drivers.isLoading && <Typography>Loading…</Typography>}
      {drivers.data?.length === 0 && <Alert severity="info">No drivers registered yet.</Alert>}

      {!!drivers.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>CNIC</TableCell>
                <TableCell>License</TableCell>
                <TableCell>License expiry</TableCell>
                <TableCell>Salary</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {drivers.data.map((d) => {
                const expired = !!d.license_expiry && d.license_expiry < todayIso();
                return (
                  <TableRow key={d.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {d.full_name}
                      {d.staff_id && <Chip size="small" label="Staff" sx={{ ml: 1 }} variant="outlined" />}
                    </TableCell>
                    <TableCell>{d.phone ?? "—"}</TableCell>
                    <TableCell>{d.cnic ?? "—"}</TableCell>
                    <TableCell>{d.license_number ?? "—"}</TableCell>
                    <TableCell sx={{ color: expired ? "error.main" : undefined }}>{fmtDate(d.license_expiry)}</TableCell>
                    <TableCell>{fmtMoney(d.salary)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={d.status} color={d.status === "active" ? "success" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => openDialog(d)}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => window.confirm(`Delete driver ${d.full_name}?`) && remove.mutate(d.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit driver" : "Add a driver"}</DialogTitle>
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
                select
                label="Link to staff record (optional)"
                value={form.staff_id}
                onChange={(e) => pickStaff(e.target.value)}
                fullWidth
              >
                <MenuItem value="">— Not on staff list —</MenuItem>
                {staff.data?.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.full_name} · {s.designation}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Full name" value={form.full_name} onChange={set("full_name")} required fullWidth />
                <TextField label="Phone" value={form.phone} onChange={set("phone")} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="CNIC" value={form.cnic} onChange={set("cnic")} fullWidth />
                <TextField label="License number" value={form.license_number} onChange={set("license_number")} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="License expiry" type="date" value={form.license_expiry} onChange={set("license_expiry")} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Monthly salary" type="number" value={form.salary} onChange={set("salary")} fullWidth />
              </Stack>
              <TextField label="Address" value={form.address} onChange={set("address")} fullWidth multiline minRows={2} />
              {editing && (
                <TextField select label="Status" value={form.status} onChange={set("status")} fullWidth>
                  <MenuItem value="active">Active</MenuItem>
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
