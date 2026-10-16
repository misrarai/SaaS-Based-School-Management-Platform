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
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import SyncIcon from "@mui/icons-material/Sync";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createVoucher,
  deleteVoucher,
  getSyncStatus,
  listAccounts,
  listVouchers,
  openVoucherPdf,
  postVoucher,
  reverseVoucher,
  runSync,
  type Voucher,
  type VoucherStatus,
  type VoucherType,
} from "../../../api/accounting";
import { AccountSelect, apiErrorMessage, DateField, FilterBar, fmtMoney, PageHeader, todayIso } from "./common";

const VOUCHER_TYPES: { value: VoucherType; label: string }[] = [
  { value: "CRV", label: "Cash Receipt (CRV)" },
  { value: "CPV", label: "Cash Payment (CPV)" },
  { value: "BRV", label: "Bank Receipt (BRV)" },
  { value: "BPV", label: "Bank Payment (BPV)" },
  { value: "JV", label: "Journal (JV)" },
];

interface LineDraft {
  key: number;
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

let lineKey = 0;
const newLine = (): LineDraft => ({ key: ++lineKey, account_id: "", debit: "", credit: "", description: "" });

export function VouchersPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<"" | VoucherType>("");
  const [statusFilter, setStatusFilter] = useState<"" | VoucherStatus>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ severity: "success" | "error" | "info"; text: string } | null>(null);
  const [viewing, setViewing] = useState<Voucher | null>(null);

  const vouchersQuery = useQuery({
    queryKey: ["acc-vouchers", typeFilter, statusFilter, dateFrom, dateTo, search],
    queryFn: () =>
      listVouchers({
        voucher_type: typeFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        q: search || undefined,
      }),
  });
  const accountsQuery = useQuery({ queryKey: ["acc-accounts"], queryFn: () => listAccounts() });
  const syncStatusQuery = useQuery({ queryKey: ["acc-sync-status"], queryFn: getSyncStatus });
  const accounts = accountsQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["acc-vouchers"] });
    queryClient.invalidateQueries({ queryKey: ["acc-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["acc-sync-status"] });
  };
  const onError = (fallback: string) => (e: unknown) => setNotice({ severity: "error", text: apiErrorMessage(e, fallback) });

  const post = useMutation({ mutationFn: postVoucher, onSuccess: invalidate, onError: onError("Could not post voucher.") });
  const remove = useMutation({ mutationFn: deleteVoucher, onSuccess: invalidate, onError: onError("Could not delete voucher.") });
  const reverse = useMutation({
    mutationFn: (id: string) => reverseVoucher(id, { reversal_date: todayIso() }),
    onSuccess: (v) => {
      setNotice({ severity: "success", text: `Reversal ${v.voucher_number} posted.` });
      invalidate();
    },
    onError: onError("Could not reverse voucher."),
  });
  const sync = useMutation({
    mutationFn: runSync,
    onSuccess: (r) => {
      setNotice({
        severity: "success",
        text: `Synced ${r.fee_vouchers_created} fee collection(s) and ${r.payout_vouchers_created} payout(s).` +
          (r.skipped_closed_period ? ` ${r.skipped_closed_period} skipped (closed period).` : ""),
      });
      invalidate();
    },
    onError: onError("Sync failed."),
  });

  // ---------- create dialog ----------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vType, setVType] = useState<VoucherType>("JV");
  const [vDate, setVDate] = useState(todayIso());
  const [narration, setNarration] = useState("");
  const [payee, setPayee] = useState("");
  const [reference, setReference] = useState("");
  const [attachment, setAttachment] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine(), newLine()]);
  const [formError, setFormError] = useState<string | null>(null);

  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.005 && totalDr > 0;

  function openCreate() {
    setVType("JV");
    setVDate(todayIso());
    setNarration("");
    setPayee("");
    setReference("");
    setAttachment("");
    setLines([newLine(), newLine()]);
    setFormError(null);
    setDialogOpen(true);
  }

  const updateLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const create = useMutation({
    mutationFn: (postNow: boolean) =>
      createVoucher({
        voucher_type: vType,
        voucher_date: vDate,
        narration: narration || undefined,
        payee: payee || undefined,
        reference: reference || undefined,
        attachment_url: attachment || undefined,
        post: postNow,
        lines: lines
          .filter((l) => l.account_id)
          .map((l) => ({
            account_id: l.account_id,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || undefined,
          })),
      }),
    onSuccess: (v) => {
      setDialogOpen(false);
      setNotice({ severity: "success", text: `Voucher ${v.voucher_number} saved as ${v.status}.` });
      invalidate();
    },
    onError: (e) => setFormError(apiErrorMessage(e, "Could not save voucher.")),
  });

  const pending = (syncStatusQuery.data?.pending_fee_payments ?? 0) + (syncStatusQuery.data?.pending_payouts ?? 0);

  return (
    <AppShell title="Vouchers" navItems={adminNavItems}>
      <PageHeader
        title="Vouchers"
        actions={
          <>
            <Button variant="outlined" startIcon={<SyncIcon />} onClick={() => sync.mutate()} disabled={sync.isPending}>
              Sync fees & payouts{pending ? ` (${pending})` : ""}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              New voucher
            </Button>
          </>
        }
      />

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <FilterBar>
        <TextField size="small" placeholder="Search no., narration, payee" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 240 }} />
        <TextField select size="small" label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | VoucherType)} sx={{ width: 190 }}>
          <MenuItem value="">All types</MenuItem>
          {VOUCHER_TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | VoucherStatus)} sx={{ width: 140 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="posted">Posted</MenuItem>
        </TextField>
        <DateField label="From" value={dateFrom} onChange={setDateFrom} />
        <DateField label="To" value={dateTo} onChange={setDateTo} />
      </FilterBar>

      {vouchersQuery.isLoading && <Typography>Loading…</Typography>}
      {vouchersQuery.data?.length === 0 && <Alert severity="info">No vouchers found.</Alert>}

      {!!vouchersQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Voucher #</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Narration</TableCell>
                <TableCell>Payee</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vouchersQuery.data.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell>
                    <Button size="small" onClick={() => setViewing(v)} sx={{ fontFamily: "monospace" }}>
                      {v.voucher_number}
                    </Button>
                  </TableCell>
                  <TableCell>{v.voucher_date}</TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>{v.narration ?? "—"}</TableCell>
                  <TableCell>{v.payee ?? "—"}</TableCell>
                  <TableCell align="right">{fmtMoney(v.total_debit)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="small" label={v.status} color={v.status === "posted" ? "success" : "default"} />
                      {v.reversed_by_id && <Chip size="small" label="reversed" color="warning" />}
                      {v.source !== "manual" && <Chip size="small" label={v.source} variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {v.status === "draft" && (
                      <>
                        <Button size="small" onClick={() => post.mutate(v.id)}>
                          Post
                        </Button>
                        <Button size="small" color="error" onClick={() => window.confirm(`Delete draft ${v.voucher_number}?`) && remove.mutate(v.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                    {v.status === "posted" && !v.reversed_by_id && !v.reversal_of_id && (
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => window.confirm(`Create a reversing journal for ${v.voucher_number}?`) && reverse.mutate(v.id)}
                      >
                        Reverse
                      </Button>
                    )}
                    <Button size="small" onClick={() => openVoucherPdf(v.id)}>
                      Print
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* View dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} fullWidth maxWidth="md">
        {viewing && (
          <>
            <DialogTitle>
              {viewing.voucher_number} · {viewing.voucher_date}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={0.5} sx={{ mb: 2 }}>
                <Typography variant="body2"><strong>Narration:</strong> {viewing.narration ?? "—"}</Typography>
                <Typography variant="body2"><strong>Payee:</strong> {viewing.payee ?? "—"}</Typography>
                <Typography variant="body2"><strong>Reference:</strong> {viewing.reference ?? "—"}</Typography>
                {viewing.attachment_url && (
                  <Typography variant="body2">
                    <strong>Attachment:</strong>{" "}
                    <a href={viewing.attachment_url} target="_blank" rel="noreferrer">
                      open
                    </a>
                  </Typography>
                )}
              </Stack>
              <Table size="small">
                <TableHead sx={darkTableHeadSx}>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewing.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.account_code} — {l.account_name}</TableCell>
                      <TableCell>{l.description ?? ""}</TableCell>
                      <TableCell align="right">{l.debit ? fmtMoney(l.debit) : ""}</TableCell>
                      <TableCell align="right">{l.credit ? fmtMoney(l.credit) : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtMoney(viewing.total_debit)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtMoney(viewing.total_credit)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => openVoucherPdf(viewing.id)}>Print PDF</Button>
              <Button onClick={() => setViewing(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>New voucher</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
              <TextField select size="small" label="Voucher type" value={vType} onChange={(e) => setVType(e.target.value as VoucherType)} sx={{ width: 220 }}>
                {VOUCHER_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
              <DateField label="Date" value={vDate} onChange={setVDate} />
              <TextField size="small" label="Payee / payer" value={payee} onChange={(e) => setPayee(e.target.value)} />
              <TextField size="small" label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Stack>
            <TextField size="small" label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} fullWidth />
            <TextField size="small" label="Attachment URL (optional)" value={attachment} onChange={(e) => setAttachment(e.target.value)} fullWidth />

            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell width={140}>Debit</TableCell>
                  <TableCell width={140}>Credit</TableCell>
                  <TableCell width={48} />
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell>
                      <AccountSelect accounts={accounts} value={l.account_id} onChange={(id) => updateLine(l.key, { account_id: id })} width="100%" />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" fullWidth value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={l.debit}
                        onChange={(e) => updateLine(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={l.credit}
                        onChange={(e) => updateLine(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" disabled={lines.length <= 2} onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => setLines((p) => [...p, newLine()])}>
                      Add line
                    </Button>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Totals</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{fmtMoney(totalDr)}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{fmtMoney(totalCr)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
            {!balanced && totalDr + totalCr > 0 && (
              <Alert severity="warning">Difference: {fmtMoney(Math.abs(totalDr - totalCr))} — debits must equal credits.</Alert>
            )}
            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" disabled={!balanced || create.isPending} onClick={() => create.mutate(false)}>
            Save draft
          </Button>
          <Button variant="contained" disabled={!balanced || create.isPending} onClick={() => create.mutate(true)}>
            Save & post
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
