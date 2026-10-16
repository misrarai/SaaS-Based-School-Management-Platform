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
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  approveRequisition, createRequisition, issueRequisition, listItems, listRequisitions,
  listStores, rejectRequisition, type Requisition, type RequisitionStatus,
} from "../../../api/inventory";
import { InventoryShell, PageHeader, FilterBar, apiErrorMessage } from "./common";

const STATUS_COLOR: Record<RequisitionStatus, "warning" | "info" | "error" | "success"> = {
  pending: "warning", approved: "info", rejected: "error", issued: "success",
};
interface Line { item_id: string; quantity_requested: string }
const newLine = (): Line => ({ item_id: "", quantity_requested: "1" });

export function RequisitionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [dlg, setDlg] = useState(false);
  const [dept, setDept] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [issueFor, setIssueFor] = useState<Requisition | null>(null);
  const [issueStore, setIssueStore] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reqs = useQuery({ queryKey: ["inv-reqs", status], queryFn: () => listRequisitions(status === "all" ? undefined : status) });
  const items = useQuery({ queryKey: ["inv-items"], queryFn: () => listItems() });
  const stores = useQuery({ queryKey: ["inv-stores"], queryFn: listStores });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["inv-reqs"] }); qc.invalidateQueries({ queryKey: ["inv-stock"] }); };

  const create = useMutation({
    mutationFn: () => createRequisition({
      department: dept, requested_by: requestedBy || undefined,
      lines: lines.filter((l) => l.item_id && Number(l.quantity_requested) > 0).map((l) => ({ item_id: l.item_id, quantity_requested: Number(l.quantity_requested) })),
    }),
    onSuccess: () => { setDlg(false); setDept(""); setRequestedBy(""); setLines([newLine()]); invalidate(); },
    onError: (e) => setError(apiErrorMessage(e, "Could not create requisition.")),
  });
  const approve = useMutation({ mutationFn: (id: string) => approveRequisition(id), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: (id: string) => rejectRequisition(id, window.prompt("Reason for rejection?") || "Rejected"), onSuccess: invalidate });
  const issue = useMutation({
    mutationFn: () => issueRequisition(issueFor!.id, issueStore),
    onSuccess: () => { setIssueFor(null); invalidate(); },
    onError: (e) => setError(apiErrorMessage(e, "Could not issue.")),
  });

  return (
    <InventoryShell title="Requisitions">
      <PageHeader title="Requisitions" actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setLines([newLine()]); setDlg(true); }}>New Requisition</Button>} />

      <FilterBar>
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
          {["all", "pending", "approved", "issued", "rejected"].map((s) => <MenuItem key={s} value={s}>{s === "all" ? "All" : s}</MenuItem>)}
        </TextField>
      </FilterBar>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>#</TableCell><TableCell>Department</TableCell><TableCell>Requested by</TableCell>
            <TableCell>Date</TableCell><TableCell>Items</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {reqs.isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
            ) : (reqs.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No requisitions.</TableCell></TableRow>
            ) : reqs.data!.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.requisition_number}</TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell>{r.requested_by || "—"}</TableCell>
                <TableCell>{r.requisition_date}</TableCell>
                <TableCell>
                  {r.lines.map((l) => `${l.item_name} ×${l.quantity_approved ?? l.quantity_requested}`).join(", ")}
                  {r.reject_reason && <div style={{ color: "#dc2626", fontSize: 12 }}>Rejected: {r.reject_reason}</div>}
                </TableCell>
                <TableCell><Chip size="small" color={STATUS_COLOR[r.status]} label={r.status} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                    {r.status === "pending" && <>
                      <Button size="small" color="success" onClick={() => approve.mutate(r.id)}>Approve</Button>
                      <Button size="small" color="error" onClick={() => reject.mutate(r.id)}>Reject</Button>
                    </>}
                    {r.status === "approved" && (
                      <Button size="small" variant="contained" onClick={() => { setIssueStore(stores.data?.[0]?.id ?? ""); setIssueFor(r); }}>Issue</Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dlg} onClose={() => setDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Requisition</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Department" fullWidth value={dept} onChange={(e) => setDept(e.target.value)} />
              <TextField size="small" label="Requested by" fullWidth value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} />
            </Stack>
            <Typography variant="subtitle2">Items</Typography>
            {lines.map((l, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <TextField select size="small" label="Item" fullWidth value={l.item_id} onChange={(e) => setLines((ls) => ls.map((x, idx) => idx === i ? { ...x, item_id: e.target.value } : x))}>
                  {(items.data ?? []).map((it) => <MenuItem key={it.id} value={it.id}>{it.name} ({it.code})</MenuItem>)}
                </TextField>
                <TextField size="small" type="number" label="Qty" sx={{ width: 100 }} value={l.quantity_requested} onChange={(e) => setLines((ls) => ls.map((x, idx) => idx === i ? { ...x, quantity_requested: e.target.value } : x))} />
                <IconButton size="small" color="error" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} disabled={lines.length === 1}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => setLines((ls) => [...ls, newLine()])}>Add item</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => create.mutate()} disabled={!dept.trim() || lines.every((l) => !l.item_id) || create.isPending}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!issueFor} onClose={() => setIssueFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>Issue {issueFor?.requisition_number}</DialogTitle>
        <DialogContent>
          <TextField select size="small" fullWidth label="Issue from store" value={issueStore} onChange={(e) => setIssueStore(e.target.value)} sx={{ mt: 1 }}>
            {(stores.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueFor(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => issue.mutate()} disabled={!issueStore || issue.isPending}>Issue Stock</Button>
        </DialogActions>
      </Dialog>
    </InventoryShell>
  );
}
