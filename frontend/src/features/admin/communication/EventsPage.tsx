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
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createEvent, deleteEvent, listEvents, type EventAudience, type EventType } from "../../../api/communication";
import { CommunicationShell, PageHeader, errorMessage, fmtDate, todayIso } from "./common";

const TYPES: EventType[] = ["event", "holiday", "exam", "meeting"];
const AUDIENCES: EventAudience[] = ["all", "staff", "students", "parents"];
const TYPE_COLOR: Record<EventType, "primary" | "success" | "warning" | "info"> = {
  event: "primary", holiday: "success", exam: "warning", meeting: "info",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function EventsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", start_date: todayIso(), end_date: "", event_type: "event" as EventType, audience: "all" as EventAudience });

  const events = useQuery({ queryKey: ["comm-events", year, month], queryFn: () => listEvents(year, month) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["comm-events"] });

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const add = useMutation({
    mutationFn: () => createEvent({
      title: form.title, description: form.description || null, start_date: form.start_date,
      end_date: form.end_date || null, event_type: form.event_type, audience: form.audience,
    }),
    onSuccess: () => { setOpen(false); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not create the event.")),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteEvent(id), onSuccess: invalidate });

  return (
    <CommunicationShell title="Events Calendar">
      <PageHeader
        title="Events Calendar"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ ...form, title: "", description: "" }); setError(null); setOpen(true); }}>Add Event</Button>}
      />

      <Paper variant="outlined" sx={{ p: 1, mb: 2, borderRadius: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton onClick={() => shift(-1)}><ChevronLeftIcon /></IconButton>
        <Typography variant="h6" sx={{ minWidth: 180, textAlign: "center" }}>{MONTHS[month - 1]} {year}</Typography>
        <IconButton onClick={() => shift(1)}><ChevronRightIcon /></IconButton>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell>Audience</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
            ) : (events.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No events this month.</TableCell></TableRow>
            ) : (
              events.data!.map((ev) => (
                <TableRow key={ev.id} hover>
                  <TableCell>{ev.title}{ev.description && <div style={{ color: "#667085", fontSize: 12 }}>{ev.description}</div>}</TableCell>
                  <TableCell><Chip size="small" color={TYPE_COLOR[ev.event_type]} label={ev.event_type} /></TableCell>
                  <TableCell>{fmtDate(ev.start_date)}{ev.end_date && ev.end_date !== ev.start_date ? ` → ${fmtDate(ev.end_date)}` : ""}</TableCell>
                  <TableCell>{ev.audience}</TableCell>
                  <TableCell align="right"><IconButton size="small" color="error" onClick={() => remove.mutate(ev.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Event</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField size="small" label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <TextField size="small" label="Description" multiline minRows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="date" label="Start" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              <TextField size="small" type="date" label="End (optional)" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="Type" fullWidth value={form.event_type} onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value as EventType }))}>
                {TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Audience" fullWidth value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as EventAudience }))}>
                {AUDIENCES.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!form.title.trim() || add.isPending}>Add</Button>
        </DialogActions>
      </Dialog>
    </CommunicationShell>
  );
}
