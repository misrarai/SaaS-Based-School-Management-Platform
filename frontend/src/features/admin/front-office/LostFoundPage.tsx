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
  createLostFound,
  deleteLostFound,
  listLostFound,
  updateLostFound,
  type LostFoundItem,
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
const EMPTY = {
  kind: "found" as LostFoundKind,
  item_name: "",
  description: "",
  location: "",
  reported_by: "",
  item_date: todayIso(),
  status: "open" as LostFoundStatus,
  claimed_by: "",
  notes: "",
};

export function LostFoundPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LostFoundItem | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const items = useQuery({ queryKey: ["fo-lostfound", kind], queryFn: () => listLostFound({ kind }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fo-lostfound"] });

  const buildPayload = () => ({
    kind: form.kind,
    item_name: form.item_name,
    description: form.description || null,
    location: form.location || null,
    reported_by: form.reported_by || null,
    item_date: form.item_date,
    status: form.status,
    claimed_by: form.claimed_by || null,
    notes: form.notes || null,
  });

  const add = useMutation({
    mutationFn: () => createLostFound(buildPayload()),
    onSuccess: () => { setOpen(false); setForm(EMPTY); setError(null); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not save the item.")),
  });

  const edit = useMutation({
    mutationFn: () => updateLostFound(editTarget!.id, buildPayload()),
    onSuccess: () => { setEditTarget(null); setError(null); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not update item.")),
  });

  const setStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LostFoundStatus }) => updateLostFound(id, { status }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteLostFound(id), onSuccess: invalidate });
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  function openAdd() {
    setForm({ ...EMPTY, item_date: todayIso() });
    setError(null);
    setOpen(true);
  }

  function openEdit(it: LostFoundItem) {
    setForm({
      kind: it.kind,
      item_name: it.item_name,
      description: it.description ?? "",
      location: it.location ?? "",
      reported_by: it.reported_by ?? "",
      item_date: it.item_date,
      status: it.status,
      claimed_by: it.claimed_by ?? "",
      notes: it.notes ?? "",
    });
    setError(null);
    setEditTarget(it);
  }

  const isEditing = editTarget !== null;
  const dialogOpen = open || isEditing;

  return (
    <FrontOfficeShell title="Lost & Found">
      <PageHeader
        title="Lost & Found"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Log Item</Button>}
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
              <TableCell>Claimed by</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.isLoading ? (
              <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>
            ) : (items.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} sx={{ color: "text.secondary" }}>No items logged.</TableCell></TableRow>
            ) : (
              items.data!.map((it) => (
                <TableRow key={it.id} hover>
                  <TableCell>{it.item_name}{it.description && <div style={{ color: "#667085", fontSize: 12 }}>{it.description}</div>}</TableCell>
                  <TableCell><Chip size="small" label={it.kind} color={it.kind === "lost" ? "error" : "primary"} variant="outlined" /></TableCell>
                  <TableCell>{it.location || "—"}</TableCell>
                  <TableCell>{it.reported_by || "—"}</TableCell>
                  <TableCell>{it.claimed_by || "—"}</TableCell>
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
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(it)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <IconButton size="small" color="error" onClick={() => window.confirm("Delete this item?") && remove.mutate(it.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => { setOpen(false); setEditTarget(null); setError(null); }} fullWidth maxWidth="sm">
        <DialogTitle>{isEditing ? "Edit Lost / Found Item" : "Log Lost / Found Item"}</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); isEditing ? edit.mutate() : add.mutate(); }}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Stack direction="row" spacing={2}>
                <TextField select size="small" label="Kind" fullWidth value={form.kind} onChange={(e) => set({ kind: e.target.value as LostFoundKind })}>
                  <MenuItem value="found">Found</MenuItem>
                  <MenuItem value="lost">Lost</MenuItem>
                </TextField>
                <TextField size="small" type="date" label="Date" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.item_date} onChange={(e) => set({ item_date: e.target.value })} />
              </Stack>
              <TextField size="small" label="Item name" value={form.item_name} onChange={(e) => set({ item_name: e.target.value })} required fullWidth autoFocus />
              <Stack direction="row" spacing={2}>
                <TextField size="small" label="Location" fullWidth value={form.location} onChange={(e) => set({ location: e.target.value })} />
                <TextField size="small" label="Reported by" fullWidth value={form.reported_by} onChange={(e) => set({ reported_by: e.target.value })} />
              </Stack>
              <TextField size="small" label="Description" multiline minRows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} fullWidth />
              <Stack direction="row" spacing={2}>
                <TextField size="small" label="Claimed by" fullWidth value={form.claimed_by} onChange={(e) => set({ claimed_by: e.target.value })} />
                {isEditing && (
                  <TextField select size="small" label="Status" fullWidth value={form.status} onChange={(e) => set({ status: e.target.value as LostFoundStatus })}>
                    {(["open", "claimed", "returned", "disposed"] as LostFoundStatus[]).map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </TextField>
                )}
              </Stack>
              <TextField size="small" label="Notes" multiline minRows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} fullWidth />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setOpen(false); setEditTarget(null); setError(null); }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!form.item_name.trim() || add.isPending || edit.isPending}>
              {isEditing ? "Save" : "Log item"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </FrontOfficeShell>
  );
}
