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
import { createPostal, deletePostal, listPostal, type PostalType } from "../../../api/frontOffice";
import { FilterTabs, FrontOfficeShell, PageHeader, errorMessage, fmtDate, todayIso } from "./common";

type Tab = "all" | PostalType;
const EMPTY = { record_type: "received" as PostalType, title: "", reference_no: "", from_title: "", to_title: "", record_date: todayIso(), notes: "" };

export function PostalPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const records = useQuery({ queryKey: ["fo-postal", tab, search], queryFn: () => listPostal({ type: tab, q: search }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fo-postal"] });
  const add = useMutation({
    mutationFn: () =>
      createPostal({
        record_type: form.record_type,
        title: form.title,
        reference_no: form.reference_no || null,
        from_title: form.from_title || null,
        to_title: form.to_title || null,
        record_date: form.record_date || undefined,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm(EMPTY);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorMessage(e, "Could not save record.")),
  });
  const remove = useMutation({ mutationFn: (id: string) => deletePostal(id), onSuccess: invalidate });
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <FrontOfficeShell title="Postal Register">
      <PageHeader
        title="Postal Receive / Dispatch"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm({ ...EMPTY, record_type: tab === "dispatched" ? "dispatched" : "received", record_date: todayIso() }); setOpen(true); }}>
            Add entry
          </Button>
        }
      />
      <FilterTabs<Tab> value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "received", label: "Received" }, { value: "dispatched", label: "Dispatched" }]} />
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField
          size="small"
          placeholder="Search title, reference, from/to"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320, maxWidth: "100%" }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Paper>

      {records.isLoading && <Typography>Loading…</Typography>}
      {records.data?.length === 0 && <Alert severity="info">No postal records.</Alert>}
      {!!records.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Reference No.</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.data.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{fmtDate(r.record_date)}</TableCell>
                  <TableCell><Chip size="small" label={r.record_type} color={r.record_type === "received" ? "info" : "secondary"} sx={{ textTransform: "capitalize" }} /></TableCell>
                  <TableCell>{r.title}</TableCell>
                  <TableCell>{r.reference_no ?? "—"}</TableCell>
                  <TableCell>{r.from_title ?? "—"}</TableCell>
                  <TableCell>{r.to_title ?? "—"}</TableCell>
                  <TableCell>{r.notes ?? "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => window.confirm("Delete this record?") && remove.mutate(r.id)}>
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
        <DialogTitle>Add postal entry</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField select label="Type" value={form.record_type} onChange={(e) => set({ record_type: e.target.value as PostalType })} fullWidth>
                  <MenuItem value="received">Received</MenuItem>
                  <MenuItem value="dispatched">Dispatched</MenuItem>
                </TextField>
                <TextField label="Date" type="date" value={form.record_date} onChange={(e) => set({ record_date: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <TextField label="Title" value={form.title} onChange={(e) => set({ title: e.target.value })} required fullWidth autoFocus />
              <TextField label="Reference no." value={form.reference_no} onChange={(e) => set({ reference_no: e.target.value })} fullWidth />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="From" value={form.from_title} onChange={(e) => set({ from_title: e.target.value })} fullWidth />
                <TextField label="To" value={form.to_title} onChange={(e) => set({ to_title: e.target.value })} fullWidth />
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
