import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createHoliday, deleteHoliday, listHolidays, type HolidayType } from "../../../api/holidays";

const TYPE_COLOR: Record<HolidayType, "error" | "primary" | "warning" | "success"> = {
  public: "error", school: "primary", exam: "warning", event: "success",
};
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function HolidayCalendarPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", from_date: "", to_date: "", holiday_type: "public" as HolidayType, description: "" });
  const [error, setError] = useState<string | null>(null);

  const holidays = useQuery({ queryKey: ["holidays", year], queryFn: () => listHolidays(year) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["holidays"] });

  const add = useMutation({
    mutationFn: () => createHoliday({ name: form.name, from_date: form.from_date, to_date: form.to_date || undefined, holiday_type: form.holiday_type, description: form.description || undefined }),
    onSuccess: () => { setOpen(false); setForm({ name: "", from_date: "", to_date: "", holiday_type: "public", description: "" }); invalidate(); },
    onError: () => setError("Could not save holiday (check the dates)."),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteHoliday(id), onSuccess: invalidate });

  const totalDays = (holidays.data ?? []).reduce((s, h) => s + h.days, 0);

  return (
    <AppShell title="Attendance — Holiday Calendar" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">Holiday Calendar</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setOpen(true); }}>Add Holiday</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1, mb: 2, borderRadius: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton onClick={() => setYear((y) => y - 1)}><ChevronLeftIcon /></IconButton>
        <Typography variant="h6" sx={{ minWidth: 80, textAlign: "center" }}>{year}</Typography>
        <IconButton onClick={() => setYear((y) => y + 1)}><ChevronRightIcon /></IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>{holidays.data?.length ?? 0} holidays · {totalDays} days off</Typography>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Holiday</TableCell><TableCell>From</TableCell><TableCell>To</TableCell>
            <TableCell align="right">Days</TableCell><TableCell>Type</TableCell><TableCell align="right" />
          </TableRow></TableHead>
          <TableBody>
            {holidays.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : (holidays.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No holidays in {year}.</TableCell></TableRow>
            ) : holidays.data!.map((h) => (
              <TableRow key={h.id} hover>
                <TableCell>{h.name}{h.description && <div style={{ color: "#667085", fontSize: 12 }}>{h.description}</div>}</TableCell>
                <TableCell>{fmt(h.from_date)}</TableCell>
                <TableCell>{h.from_date === h.to_date ? "—" : fmt(h.to_date)}</TableCell>
                <TableCell align="right">{h.days}</TableCell>
                <TableCell><Chip size="small" color={TYPE_COLOR[h.holiday_type]} label={h.holiday_type} /></TableCell>
                <TableCell align="right"><IconButton size="small" color="error" onClick={() => remove.mutate(h.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Holiday</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField size="small" label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="date" label="From" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.from_date} onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))} />
              <TextField size="small" type="date" label="To (optional)" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.to_date} onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))} />
            </Stack>
            <TextField select size="small" label="Type" value={form.holiday_type} onChange={(e) => setForm((f) => ({ ...f, holiday_type: e.target.value as HolidayType }))}>
              {(["public", "school", "exam", "event"] as HolidayType[]).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!form.name.trim() || !form.from_date || add.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
