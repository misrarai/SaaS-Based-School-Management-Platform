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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointment,
  type Appointment,
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
const EMPTY = { visitor_name: "", phone: "", purpose: "", with_whom: "", appointment_date: todayIso(), appointment_time: "", status: "scheduled" as AppointmentStatus, notes: "" };

export function AppointmentsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const appts = useQuery({
    queryKey: ["fo-appointments", status],
    queryFn: () => listAppointments({ status }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fo-appointments"] });

  const buildPayload = () => ({
    visitor_name: form.visitor_name,
    phone: form.phone || null,
    purpose: form.purpose,
    with_whom: form.with_whom || null,
    appointment_date: form.appointment_date,
    appointment_time: form.appointment_time || null,
    status: form.status,
    notes: form.notes || null,
  });

  const add = useMutation({
    mutationFn: () => createAppointment(buildPayload()),
    onSuccess: () => { setOpen(false); setForm(EMPTY); setError(null); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not book the appointment.")),
  });

  const edit = useMutation({
    mutationFn: () => updateAppointment(editTarget!.id, buildPayload()),
    onSuccess: () => { setEditTarget(null); setError(null); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not update appointment.")),
  });

  const setStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointment(id, { status }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteAppointment(id), onSuccess: invalidate });
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  function openAdd() {
    setForm({ ...EMPTY, appointment_date: todayIso() });
    setError(null);
    setOpen(true);
  }

  function openEdit(a: Appointment) {
    setForm({
      visitor_name: a.visitor_name,
      phone: a.phone ?? "",
      purpose: a.purpose,
      with_whom: a.with_whom ?? "",
      appointment_date: a.appointment_date,
      appointment_time: a.appointment_time ?? "",
      status: a.status,
      notes: a.notes ?? "",
    });
    setError(null);
    setEditTarget(a);
  }

  const isEditing = editTarget !== null;
  const dialogOpen = open || isEditing;

  return (
    <FrontOfficeShell title="Appointments">
      <PageHeader
        title="Appointments"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Book Appointment</Button>}
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
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <IconButton size="small" color="error" onClick={() => window.confirm("Delete appointment?") && remove.mutate(a.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => { setOpen(false); setEditTarget(null); setError(null); }} fullWidth maxWidth="sm">
        <DialogTitle>{isEditing ? "Edit Appointment" : "Book Appointment"}</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); isEditing ? edit.mutate() : add.mutate(); }}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField size="small" label="Visitor name" value={form.visitor_name} onChange={(e) => set({ visitor_name: e.target.value })} required fullWidth autoFocus />
              <Stack direction="row" spacing={2}>
                <TextField size="small" label="Phone" fullWidth value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
                <TextField size="small" label="With whom" fullWidth value={form.with_whom} onChange={(e) => set({ with_whom: e.target.value })} />
              </Stack>
              <TextField size="small" label="Purpose" value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} required fullWidth />
              <Stack direction="row" spacing={2}>
                <TextField size="small" type="date" label="Date" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.appointment_date} onChange={(e) => set({ appointment_date: e.target.value })} />
                <TextField size="small" type="time" label="Time" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.appointment_time} onChange={(e) => set({ appointment_time: e.target.value })} />
              </Stack>
              {isEditing && (
                <TextField select size="small" label="Status" fullWidth value={form.status} onChange={(e) => set({ status: e.target.value as AppointmentStatus })}>
                  {(["scheduled", "completed", "cancelled", "no_show"] as AppointmentStatus[]).map((s) => (
                    <MenuItem key={s} value={s}>{s.replace("_", " ")}</MenuItem>
                  ))}
                </TextField>
              )}
              <TextField size="small" label="Notes" multiline minRows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} fullWidth />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setOpen(false); setEditTarget(null); setError(null); }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!form.visitor_name.trim() || !form.purpose.trim() || add.isPending || edit.isPending}>
              {isEditing ? "Save" : "Book"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </FrontOfficeShell>
  );
}
