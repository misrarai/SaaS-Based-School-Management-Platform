import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointment,
  type AppointmentStatus,
} from "../../../api/frontOffice";
import { FrontOfficeShell, PageHeader, FilterTabs, errorMessage, fmtDate, todayIso } from "./common";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];
const STATUS_COLOR: Record<AppointmentStatus, "info" | "success" | "default" | "warning"> = {
  scheduled: "info",
  completed: "success",
  cancelled: "default",
  no_show: "warning",
};
const EMPTY = { visitor_name: "", phone: "", purpose: "", with_whom: "", appointment_date: todayIso(), appointment_time: "", notes: "" };

export function AppointmentsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const appts = useQuery({
    queryKey: ["fo-appointments", status],
    queryFn: () => listAppointments({ status }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fo-appointments"] });

  const add = useMutation({
    mutationFn: () =>
      createAppointment({
        visitor_name: form.visitor_name,
        phone: form.phone || null,
        purpose: form.purpose,
        with_whom: form.with_whom || null,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time || null,
        notes: form.notes || null,
      }),
    onSuccess: () => { setOpen(false); setForm(EMPTY); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not book the appointment.")),
  });
  const setStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointment(id, { status }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteAppointment(id), onSuccess: invalidate });

  return (
    <FrontOfficeShell title="Appointments">
      <PageHeader
        title="Appointments"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setError(null); setOpen(true); }}>Book Appointment</Button>}
      />

      <FilterTabs options={STATUS_FILTERS} value={status} onChange={setStatus} />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Visitor</TableCell>
              <TableCell>Purpose</TableCell>
              <TableCell>With</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appts.isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
            ) : (appts.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No appointments.</TableCell></TableRow>
            ) : (
              appts.data!.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.visitor_name}{a.phone && <div style={{ color: "#667085", fontSize: 12 }}>{a.phone}</div>}</TableCell>
                  <TableCell>{a.purpose}</TableCell>
                  <TableCell>{a.with_whom || "—"}</TableCell>
                  <TableCell>{fmtDate(a.appointment_date)}</TableCell>
                  <TableCell>{a.appointment_time || "—"}</TableCell>
                  <TableCell>
                    <TextField
                      select size="small" variant="standard" value={a.status}
                      onChange={(e) => setStatusMut.mutate({ id: a.id, status: e.target.value as AppointmentStatus })}
                      slotProps={{ input: { disableUnderline: true } }}
                    >
                      {(["scheduled", "completed", "cancelled", "no_show"] as AppointmentStatus[]).map((s) => (
                        <MenuItem key={s} value={s}>
                          <Chip size="small" color={STATUS_COLOR[s]} label={s.replace("_", " ")} />
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => remove.mutate(a.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Book Appointment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField size="small" label="Visitor name" value={form.visitor_name} onChange={(e) => setForm((f) => ({ ...f, visitor_name: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Phone" fullWidth value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <TextField size="small" label="With whom" fullWidth value={form.with_whom} onChange={(e) => setForm((f) => ({ ...f, with_whom: e.target.value }))} />
            </Stack>
            <TextField size="small" label="Purpose" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="date" label="Date" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.appointment_date} onChange={(e) => setForm((f) => ({ ...f, appointment_date: e.target.value }))} />
              <TextField size="small" type="time" label="Time" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.appointment_time} onChange={(e) => setForm((f) => ({ ...f, appointment_time: e.target.value }))} />
            </Stack>
            <TextField size="small" label="Notes" multiline minRows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!form.visitor_name.trim() || !form.purpose.trim() || add.isPending}>Book</Button>
        </DialogActions>
      </Dialog>
    </FrontOfficeShell>
  );
}
