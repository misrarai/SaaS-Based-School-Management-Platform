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
  createAdjustment, createIssue, createPurchase, createStore,
  listItems, listStockLevels, listStores,
} from "../../../api/inventory";
import { InventoryShell, PageHeader, apiErrorMessage, todayIso } from "./common";

type Mode = "purchase" | "issue" | "adjustment";
interface Line { item_id: string; quantity: string; unit_price: string }
const newLine = (): Line => ({ item_id: "", quantity: "1", unit_price: "" });

export function StockPage() {
  const qc = useQueryClient();
  const [storeFilter, setStoreFilter] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [storeId, setStoreId] = useState("");
  const [issuedToType, setIssuedToType] = useState<"department" | "person" | "class">("department");
  const [issuedTo, setIssuedTo] = useState("");
  const [reason, setReason] = useState<"damage" | "loss" | "expired" | "found" | "correction">("correction");
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [newStore, setNewStore] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stores = useQuery({ queryKey: ["inv-stores"], queryFn: listStores });
  const items = useQuery({ queryKey: ["inv-items"], queryFn: () => listItems() });
  const levels = useQuery({ queryKey: ["inv-stock", storeFilter], queryFn: () => listStockLevels({ store_id: storeFilter || undefined }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["inv-stock"] }); qc.invalidateQueries({ queryKey: ["inv-items"] }); };

  const addStore = useMutation({ mutationFn: () => createStore({ name: newStore.trim() }), onSuccess: () => { setNewStore(""); qc.invalidateQueries({ queryKey: ["inv-stores"] }); } });

  const submit = useMutation({
    mutationFn: () => {
      const payloadLines = lines.filter((l) => l.item_id && Number(l.quantity) > 0).map((l) => ({
        item_id: l.item_id, quantity: Number(l.quantity), unit_price: l.unit_price ? Number(l.unit_price) : undefined,
      }));
      const base = { store_id: storeId, txn_date: todayIso(), lines: payloadLines };
      if (mode === "purchase") return createPurchase(base);
      if (mode === "issue") return createIssue({ ...base, issued_to_type: issuedToType, issued_to: issuedTo });
      return createAdjustment({ ...base, reason, direction });
    },
    onSuccess: () => { setMode(null); setLines([newLine()]); refresh(); },
    onError: (e) => setError(apiErrorMessage(e, "Could not save the stock document.")),
  });

  const open = (m: Mode) => { setError(null); setMode(m); setStoreId(stores.data?.[0]?.id ?? ""); setLines([newLine()]); setIssuedTo(""); };
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const title = mode === "purchase" ? "Receive Stock (Purchase)" : mode === "issue" ? "Issue Stock" : "Stock Adjustment";

  return (
    <InventoryShell title="Stationery / Stock">
      <PageHeader
        title="Stationery / Stock"
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => open("purchase")}>Receive</Button>
            <Button variant="outlined" onClick={() => open("issue")}>Issue</Button>
            <Button variant="outlined" onClick={() => open("adjustment")}>Adjust</Button>
          </Stack>
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField select size="small" label="Store" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All stores</MenuItem>
          {(stores.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
        </TextField>
        <Stack direction="row" spacing={1}>
          <TextField size="small" label="New store" value={newStore} onChange={(e) => setNewStore(e.target.value)} />
          <Button onClick={() => addStore.mutate()} disabled={!newStore.trim()}>Add store</Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Item</TableCell><TableCell>Code</TableCell><TableCell>Store</TableCell>
            <TableCell align="right">Quantity</TableCell><TableCell align="right">Reorder</TableCell><TableCell>Status</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {levels.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : (levels.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No stock yet. Receive stock to get started.</TableCell></TableRow>
            ) : levels.data!.map((l) => (
              <TableRow key={`${l.item_id}-${l.store_id}`} hover>
                <TableCell>{l.item_name}</TableCell>
                <TableCell>{l.item_code}</TableCell>
                <TableCell>{l.store_name}</TableCell>
                <TableCell align="right">{l.quantity} {l.unit_name || ""}</TableCell>
                <TableCell align="right">{l.reorder_level}</TableCell>
                <TableCell>{l.quantity <= l.reorder_level ? <Chip size="small" color="error" label="Low" /> : <Chip size="small" color="success" label="OK" />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!mode} onClose={() => setMode(null)} fullWidth maxWidth="md">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
              <TextField select size="small" label="Store" value={storeId} onChange={(e) => setStoreId(e.target.value)} sx={{ minWidth: 180 }}>
                {(stores.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
              {mode === "issue" && (
                <>
                  <TextField select size="small" label="Issue to" value={issuedToType} onChange={(e) => setIssuedToType(e.target.value as typeof issuedToType)} sx={{ minWidth: 140 }}>
                    <MenuItem value="department">Department</MenuItem><MenuItem value="person">Person</MenuItem><MenuItem value="class">Class</MenuItem>
                  </TextField>
                  <TextField size="small" label="Recipient" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} />
                </>
              )}
              {mode === "adjustment" && (
                <>
                  <TextField select size="small" label="Reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} sx={{ minWidth: 140 }}>
                    {["damage", "loss", "expired", "found", "correction"].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <TextField select size="small" label="Direction" value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} sx={{ minWidth: 130 }}>
                    <MenuItem value="increase">Increase</MenuItem><MenuItem value="decrease">Decrease</MenuItem>
                  </TextField>
                </>
              )}
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={darkTableHeadSx}><TableRow>
                  <TableCell>Item</TableCell><TableCell align="right">Qty</TableCell>
                  {mode === "purchase" && <TableCell align="right">Unit price</TableCell>}
                  <TableCell />
                </TableRow></TableHead>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <TextField select size="small" fullWidth value={l.item_id} onChange={(e) => setLine(i, { item_id: e.target.value })}>
                          {(items.data ?? []).map((it) => <MenuItem key={it.id} value={it.id}>{it.name} ({it.code})</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell align="right" width={100}><TextField size="small" type="number" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></TableCell>
                      {mode === "purchase" && <TableCell align="right" width={120}><TextField size="small" type="number" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} /></TableCell>}
                      <TableCell width={48}><IconButton size="small" color="error" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} disabled={lines.length === 1}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setLines((ls) => [...ls, newLine()])}>Add line</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => submit.mutate()} disabled={!storeId || lines.every((l) => !l.item_id) || submit.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </InventoryShell>
  );
}
