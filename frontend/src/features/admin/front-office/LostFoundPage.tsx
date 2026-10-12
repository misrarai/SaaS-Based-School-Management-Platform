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
  createLostFound,
  deleteLostFound,
  listLostFound,
  updateLostFound,
  type LostFoundKind,
  type LostFoundStatus,
} from "../../../api/frontOffice";
import { FrontOfficeShell, PageHeader, FilterTabs, errorMessage, fmtDate, todayIso } from "./common";

const KIND_FILTERS = [
  { value: "all", label: "All" },
  { value: "lost", label: "Lost" },
  { value: "found", label: "Found" },
];
const STATUS_COLOR: Record<LostFoundStatus, "warning" | "info" | "success" | "default"> = {
  open: "warning",
  claimed: "info",
  returned: "success",
  disposed: "default",
};
const EMPTY = { kind: "found" as LostFoundKind, item_name: "", description: "", location: "", reported_by: "", item_date: todayIso(), notes: "" };

export function LostFoundPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const items = useQuery({ queryKey: ["fo-lostfound", kind], queryFn: () => listLostFound({ kind }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fo-lostfound"] });

  const add = useMutation({
    mutationFn: () =>
      createLostFound({
        kind: form.kind,
        item_name: form.item_name,
        description: form.description || null,
        location: form.location || null,
        reported_by: form.reported_by || null,
        item_date: form.item_date,
        notes: form.notes || null,
      }),
    onSuccess: () => { setOpen(false); setForm(EMPTY); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not save the item.")),
  });
  const setStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LostFoundStatus }) => updateLostFound(id, { status }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteLostFound(id), onSuccess: invalidate });

  return (
    <FrontOfficeShell title="Lost & Found">
      <PageHeader
        title="Lost & Found"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setError(null); setOpen(true); }}>Log Item</Button>}
      />

      <FilterTabs options={KIND_FILTERS} value={kind} onChange={setKind} />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Reported by</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
            ) : (items.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No items logged.</TableCell></TableRow>
            ) : (
              items.data!.map((it) => (
                <TableRow key={it.id} hover>
                  <TableCell>{it.item_name}{it.description && <div style={{ color: "#667085", fontSize: 12 }}>{it.description}</div>}</TableCell>
                  <TableCell><Chip size="small" label={it.kind} color={it.kind === "lost" ? "error" : "primary"} variant="outlined" /></TableCell>
                  <TableCell>{it.location || "—"}</TableCell>
                  <TableCell>{it.reported_by || "—"}{it.claimed_by && <div style={{ color: "#667085", fontSize: 12 }}>claimed: {it.claimed_by}</div>}</TableCell>
                  <TableCell>{fmtDate(it.item_date)}</TableCell>
                  <TableCell>
                    <TextField
                      select size="small" variant="standard" value={it.status}
                      onChange={(e) => setStatusMut.mutate({ id: it.id, status: e.target.value as LostFoundStatus })}
                      slotProps={{ input: { disableUnderline: true } }}
                    >
                      {(["open", "claimed", "returned", "disposed"] as LostFoundStatus[]).map((s) => (
                        <MenuItem key={s} value={s}><Chip size="small" color={STATUS_COLOR[s]} label={s} /></MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => remove.mutate(it.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Log Lost / Found Item</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="Kind" fullWidth value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as LostFoundKind }))}>
                <MenuItem value="found">Found</MenuItem>
                <MenuItem value="lost">Lost</MenuItem>
              </TextField>
              <TextField size="small" type="date" label="Date" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.item_date} onChange={(e) => setForm((f) => ({ ...f, item_date: e.target.value }))} />
            </Stack>
            <TextField size="small" label="Item name" value={form.item_name} onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Location" fullWidth value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              <TextField size="small" label="Reported by" fullWidth value={form.reported_by} onChange={(e) => setForm((f) => ({ ...f, reported_by: e.target.value }))} />
            </Stack>
            <TextField size="small" label="Description" multiline minRows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!form.item_name.trim() || add.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </FrontOfficeShell>
  );
}
