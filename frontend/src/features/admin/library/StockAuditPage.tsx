import { useRef, useState } from "react";
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
  LinearProgress,
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
import DoneIcon from "@mui/icons-material/CheckCircle";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  completeStockAudit,
  createStockAudit,
  getStockAudit,
  listStockAudits,
  scanStockAudit,
  libraryErrorMessage,
  type StockAudit,
} from "../../../api/library";
import { StatTile, CopyStatusChip } from "../../libraryShared";

function AuditRunner({ auditId }: { auditId: string }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const detail = useQuery({ queryKey: ["library", "stocktake", auditId], queryFn: () => getStockAudit(auditId) });

  const scan = useMutation({
    mutationFn: (c: string) => scanStockAudit(auditId, c),
    onSuccess: (res) => {
      setFlash({ ok: res.ok, msg: res.message });
      qc.invalidateQueries({ queryKey: ["library", "stocktake", auditId] });
    },
    onError: (e) => setFlash({ ok: false, msg: libraryErrorMessage(e, "Scan failed") }),
  });
  const complete = useMutation({
    mutationFn: () => completeStockAudit(auditId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library", "stocktake", auditId] });
      qc.invalidateQueries({ queryKey: ["library", "stocktakes"] });
    },
  });

  const d = detail.data;
  const done = d?.status === "completed";
  const pct = d && d.total_expected > 0 ? Math.round((d.total_seen / d.total_expected) * 100) : 0;

  const submit = () => {
    const c = code.trim();
    if (!c || done) return;
    scan.mutate(c);
    setCode("");
    inputRef.current?.focus();
  };

  if (!d) return <LinearProgress />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2, alignItems: "center" }}>
        <StatTile label="Expected" value={d.total_expected} />
        <StatTile label="Seen" value={d.total_seen} tone="#059669" />
        <StatTile label="Missing" value={d.total_missing} tone="#dc2626" />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">{pct}% scanned</Typography>
          <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 1 }} />
        </Box>
        {!done && (
          <Button variant="outlined" color="success" startIcon={<DoneIcon />} onClick={() => complete.mutate()} disabled={complete.isPending}>
            Complete audit
          </Button>
        )}
        {done && <Chip color="success" label="Completed" />}
      </Stack>

      {!done && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <TextField
            inputRef={inputRef} fullWidth size="small" autoFocus
            label="Scan a copy (accession number or barcode)"
            value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          {flash && <Alert severity={flash.ok ? "success" : "error"} sx={{ mt: 1 }}>{flash.msg}</Alert>}
        </Paper>
      )}

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, alignItems: "start" }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Typography variant="h6" sx={{ p: 2, pb: 1, color: "error.main" }}>
            {done ? "Missing" : "Not yet scanned"} ({d.missing_copies.length})
          </Typography>
          <TableContainer sx={{ maxHeight: 360 }}>
            <Table size="small" stickyHeader>
              <TableHead sx={darkTableHeadSx}>
                <TableRow><TableCell>Accession</TableCell><TableCell>Book</TableCell><TableCell>Status</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {d.missing_copies.length === 0 ? (
                  <TableRow><TableCell colSpan={3} sx={{ color: "text.secondary" }}>All copies accounted for. 🎉</TableCell></TableRow>
                ) : d.missing_copies.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{c.accession_number}</TableCell>
                    <TableCell>{c.book_title}</TableCell>
                    <TableCell><CopyStatusChip status={c.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Typography variant="h6" sx={{ p: 2, pb: 1, color: "success.main" }}>Scanned ({d.seen_copies.length})</Typography>
          <TableContainer sx={{ maxHeight: 360 }}>
            <Table size="small" stickyHeader>
              <TableHead sx={darkTableHeadSx}>
                <TableRow><TableCell>Accession</TableCell><TableCell>Book</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {d.seen_copies.length === 0 ? (
                  <TableRow><TableCell colSpan={2} sx={{ color: "text.secondary" }}>Nothing scanned yet.</TableCell></TableRow>
                ) : d.seen_copies.map((c) => (
                  <TableRow key={c.id} hover><TableCell>{c.accession_number}</TableCell><TableCell>{c.book_title}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Stack>
  );
}

export function StockAuditPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const audits = useQuery({ queryKey: ["library", "stocktakes"], queryFn: listStockAudits });

  const create = useMutation({
    mutationFn: () => createStockAudit({ name: name.trim() }),
    onSuccess: (a: StockAudit) => {
      setDialog(false); setName("");
      qc.invalidateQueries({ queryKey: ["library", "stocktakes"] });
      setOpenId(a.id);
    },
  });

  if (openId) {
    return (
      <AppShell title="Library — Stock Audit" navItems={adminNavItems}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h4">Stock Audit</Typography>
          <Button onClick={() => setOpenId(null)}>← All audits</Button>
        </Stack>
        <AuditRunner auditId={openId} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Library — Stock Audit" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">Stock Audit</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setName(""); setDialog(true); }}>Start New Audit</Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Started</TableCell>
              <TableCell align="right">Expected</TableCell>
              <TableCell align="right">Seen</TableCell>
              <TableCell align="right">Missing</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {audits.isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
            ) : (audits.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No audits yet. Start one to reconcile your shelves.</TableCell></TableRow>
            ) : (
              audits.data!.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{new Date(a.started_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                  <TableCell align="right">{a.total_expected}</TableCell>
                  <TableCell align="right">{a.total_seen}</TableCell>
                  <TableCell align="right">{a.total_missing}</TableCell>
                  <TableCell><Chip size="small" color={a.status === "completed" ? "default" : "success"} label={a.status === "completed" ? "Completed" : "In progress"} /></TableCell>
                  <TableCell align="right"><Button size="small" onClick={() => setOpenId(a.id)}>Open</Button></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialog} onClose={() => setDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Start Stock Audit</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" label="Audit name" placeholder="e.g. Annual stock-take 2026" value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>Start</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
