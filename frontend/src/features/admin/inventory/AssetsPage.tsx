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
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createAsset, disposeAsset, listAssets, type AssetCondition, type FixedAsset } from "../../../api/inventory";
import { InventoryShell, PageHeader, FilterBar, apiErrorMessage, fmtMoney, todayIso } from "./common";

const CONDITIONS: AssetCondition[] = ["new", "good", "fair", "poor", "damaged"];
const EMPTY = { asset_tag: "", name: "", category: "", location: "", purchase_date: todayIso(), cost: "", salvage_value: "", depreciation_rate: "", assigned_to: "", condition: "good" as AssetCondition };

export function AssetsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"active" | "disposed">("active");
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [disposeFor, setDisposeFor] = useState<FixedAsset | null>(null);
  const [disposal, setDisposal] = useState({ disposal_date: todayIso(), disposal_value: "", disposal_notes: "" });
  const [error, setError] = useState<string | null>(null);

  const assets = useQuery({ queryKey: ["inv-assets", status], queryFn: () => listAssets(status) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["inv-assets"] });

  const add = useMutation({
    mutationFn: () => createAsset({
      asset_tag: form.asset_tag || undefined, name: form.name, category: form.category || undefined,
      location: form.location || undefined, purchase_date: form.purchase_date, cost: Number(form.cost) || 0,
      salvage_value: form.salvage_value ? Number(form.salvage_value) : undefined,
      depreciation_rate: form.depreciation_rate ? Number(form.depreciation_rate) : undefined,
      assigned_to: form.assigned_to || undefined, condition: form.condition,
    }),
    onSuccess: () => { setDlg(false); setForm(EMPTY); invalidate(); },
    onError: (e) => setError(apiErrorMessage(e, "Could not add the asset.")),
  });
  const dispose = useMutation({
    mutationFn: () => disposeAsset(disposeFor!.id, {
      disposal_date: disposal.disposal_date,
      disposal_value: disposal.disposal_value ? Number(disposal.disposal_value) : undefined,
      disposal_notes: disposal.disposal_notes || undefined,
    }),
    onSuccess: () => { setDisposeFor(null); invalidate(); },
  });

  return (
    <InventoryShell title="Assets">
      <PageHeader title="Fixed Assets" actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setError(null); setDlg(true); }}>Add Asset</Button>} />

      <FilterBar>
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} sx={{ minWidth: 150 }}>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="disposed">Disposed</MenuItem>
        </TextField>
      </FilterBar>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Tag</TableCell><TableCell>Name</TableCell><TableCell>Category</TableCell><TableCell>Location</TableCell>
            <TableCell>Assigned</TableCell><TableCell align="right">Cost</TableCell><TableCell align="right">Book value</TableCell>
            <TableCell>Condition</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {assets.isLoading ? (
              <TableRow><TableCell colSpan={9}>Loading…</TableCell></TableRow>
            ) : (assets.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={9} sx={{ color: "text.secondary" }}>No {status} assets.</TableCell></TableRow>
            ) : assets.data!.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>{a.asset_tag}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell>{a.category || "—"}</TableCell>
                <TableCell>{a.location || "—"}</TableCell>
                <TableCell>{a.assigned_to || "—"}</TableCell>
                <TableCell align="right">{fmtMoney(a.cost)}</TableCell>
                <TableCell align="right">{fmtMoney(a.book_value)}</TableCell>
                <TableCell><Chip size="small" label={a.condition} /></TableCell>
                <TableCell align="right">
                  {a.status === "active" ? <Button size="small" color="warning" onClick={() => { setDisposal({ disposal_date: todayIso(), disposal_value: "", disposal_notes: "" }); setDisposeFor(a); }}>Dispose</Button> : <Chip size="small" label="disposed" />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dlg} onClose={() => setDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Fixed Asset</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Name" fullWidth value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <TextField size="small" label="Asset tag (optional)" value={form.asset_tag} onChange={(e) => setForm((f) => ({ ...f, asset_tag: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Category" fullWidth value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              <TextField size="small" label="Location" fullWidth value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="date" label="Purchase date" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} />
              <TextField size="small" type="number" label="Cost" fullWidth value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="number" label="Salvage value" fullWidth value={form.salvage_value} onChange={(e) => setForm((f) => ({ ...f, salvage_value: e.target.value }))} />
              <TextField size="small" type="number" label="Depreciation % / yr" fullWidth value={form.depreciation_rate} onChange={(e) => setForm((f) => ({ ...f, depreciation_rate: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Assigned to" fullWidth value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))} />
              <TextField select size="small" label="Condition" fullWidth value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as AssetCondition }))}>
                {CONDITIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!form.name.trim() || !form.cost || add.isPending}>Add</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!disposeFor} onClose={() => setDisposeFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>Dispose — {disposeFor?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField size="small" type="date" label="Disposal date" slotProps={{ inputLabel: { shrink: true } }} value={disposal.disposal_date} onChange={(e) => setDisposal((d) => ({ ...d, disposal_date: e.target.value }))} />
            <TextField size="small" type="number" label="Disposal value" value={disposal.disposal_value} onChange={(e) => setDisposal((d) => ({ ...d, disposal_value: e.target.value }))} />
            <TextField size="small" label="Notes" value={disposal.disposal_notes} onChange={(e) => setDisposal((d) => ({ ...d, disposal_notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisposeFor(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => dispose.mutate()} disabled={dispose.isPending}>Dispose</Button>
        </DialogActions>
      </Dialog>
    </InventoryShell>
  );
}
