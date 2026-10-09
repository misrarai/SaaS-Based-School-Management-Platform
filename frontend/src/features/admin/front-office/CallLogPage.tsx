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
  InputAdornment,
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
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createCall, deleteCall, listCalls, type CallType } from "../../../api/frontOffice";
import { FilterTabs, FrontOfficeShell, PageHeader, errorMessage, fmtDate, todayIso } from "./common";

type Tab = "all" | CallType;
const EMPTY = { caller_name: "", phone: "", purpose: "", call_date: todayIso(), call_type: "incoming" as CallType, follow_up_date: "", duration_minutes: "", notes: "" };

export function CallLogPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const calls = useQuery({ queryKey: ["fo-calls", tab, search], queryFn: () => listCalls({ type: tab, q: search }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fo-calls"] });
  const add = useMutation({
    mutationFn: () =>
      createCall({
        caller_name: form.caller_name,
        phone: form.phone || null,
        purpose: form.purpose,
        call_date: form.call_date || undefined,
        call_type: form.call_type,
        follow_up_date: form.follow_up_date || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm(EMPTY);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorMessage(e, "Could not save call.")),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteCall(id), onSuccess: invalidate });
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <FrontOfficeShell title="Phone Call Log">
      <PageHeader
        title="Phone Call Log"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ ...EMPTY, call_date: todayIso() }); setOpen(true); }}>
            Log call
          </Button>
        }
      />
      <FilterTabs<Tab> value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "incoming", label: "Incoming" }, { value: "outgoing", label: "Outgoing" }]} />
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField
          size="small"
          placeholder="Search caller, phone or purpose"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320, maxWidth: "100%" }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Paper>

      {calls.isLoading && <Typography>Loading…</Typography>}
      {calls.data?.length === 0 && <Alert severity="info">No calls logged.</Alert>}
      {!!calls.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Caller</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Purpose</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Follow-up</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calls.data.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{fmtDate(c.call_date)}</TableCell>
                  <TableCell><Chip size="small" label={c.call_type} color={c.call_type === "incoming" ? "info" : "secondary"} sx={{ textTransform: "capitalize" }} /></TableCell>
                  <TableCell>{c.caller_name}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.purpose}</TableCell>
                  <TableCell>{c.duration_minutes != null ? `${c.duration_minutes} min` : "—"}</TableCell>
                  <TableCell>{fmtDate(c.follow_up_date)}</TableCell>
                  <TableCell>{c.notes ?? "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => window.confirm("Delete this call?") && remove.mutate(c.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Log a phone call</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField select label="Call type" value={form.call_type} onChange={(e) => set({ call_type: e.target.value as CallType })} fullWidth>
                  <MenuItem value="incoming">Incoming</MenuItem>
                  <MenuItem value="outgoing">Outgoing</MenuItem>
                </TextField>
                <TextField label="Date" type="date" value={form.call_date} onChange={(e) => set({ call_date: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Caller name" value={form.caller_name} onChange={(e) => set({ caller_name: e.target.value })} required fullWidth autoFocus />
                <TextField label="Phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} fullWidth />
              </Stack>
              <TextField label="Purpose" value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} required fullWidth />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Duration (min)" type="number" value={form.duration_minutes} onChange={(e) => set({ duration_minutes: e.target.value })} fullWidth />
                <TextField label="Follow-up date" type="date" value={form.follow_up_date} onChange={(e) => set({ follow_up_date: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <TextField label="Notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} fullWidth multiline minRows={2} />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={add.isPending}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </FrontOfficeShell>
  );
}
