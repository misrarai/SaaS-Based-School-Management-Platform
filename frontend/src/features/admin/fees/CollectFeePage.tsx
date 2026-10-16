import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PaymentsIcon from "@mui/icons-material/Payments";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  searchCounter,
  getCounterAccount,
  collectPayment,
  getReceiptPdfUrl,
  type CounterAccount,
  type PaymentMethod,
  type Receipt,
  type InvoiceSummary,
} from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  pending: "warning",
  partial: "warning",
  paid: "success",
  overdue: "error",
  cancelled: "default",
};

export function CollectFeePage() {
  const [searchQ, setSearchQ] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [refNote, setRefNote] = useState("");
  const [collectedOn, setCollectedOn] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [isPartial, setIsPartial] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = useQuery({
    queryKey: ["counter-search", searchQ],
    queryFn: () => searchCounter(searchQ),
    enabled: searchQ.length >= 1,
  });

  const accountQuery = useQuery({
    queryKey: ["counter-account", selectedStudentId, selectedFamilyId],
    queryFn: () => getCounterAccount(
      selectedFamilyId ? { family_id: selectedFamilyId } : { student_id: selectedStudentId! }
    ),
    enabled: !!(selectedStudentId || selectedFamilyId),
  });

  const account: CounterAccount | undefined = accountQuery.data;
  const totalDues = account?.total_outstanding ?? 0;

  const collect = useMutation({
    mutationFn: () => collectPayment({
      ...(selectedFamilyId ? { family_id: selectedFamilyId } : { student_id: selectedStudentId! }),
      amount: Number(amount),
      payment_method: method,
      reference_note: refNote || undefined,
      collected_on: collectedOn || undefined,
      invoice_ids: selectedInvoices.length ? selectedInvoices : undefined,
    }),
    onSuccess: (receipt) => {
      setLastReceipt(receipt);
      setAmount("");
      setRefNote("");
      setIsPartial(false);
      setSelectedInvoices([]);
      accountQuery.refetch();
      setError(null);
    },
    onError: () => setError("Payment collection failed. Please try again."),
  });

  const handleLoad = (studentId: string, familyId: string | null) => {
    setSelectedStudentId(studentId);
    setSelectedFamilyId(familyId);
    setLastReceipt(null);
    setSearchQ("");
    if (!isPartial && account) {
      setAmount(String(account.total_outstanding));
    }
  };

  const handleReceive = () => {
    if (!amount || Number(amount) <= 0) return;
    if (!isPartial) {
      setAmount(String(totalDues));
    }
    collect.mutate();
  };

  const toggleInvoice = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const invoiceTotal = (account?.open_invoices ?? [])
    .filter((inv) => selectedInvoices.includes(inv.id))
    .reduce((sum, inv) => sum + inv.balance, 0);

  return (
    <AppShell title="Collect Fee" navItems={adminNavItems}>
      <Typography variant="h4" mb={3}>Collect Fee</Typography>

      {/* Search bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle2" mb={1} color="text.secondary">
          Search by Admission Number or Student Name
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            fullWidth
            placeholder="Type admission number or name…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "text.disabled" }} /> }}
            size="small"
          />
        </Stack>

        {searchQ.length >= 1 && searchQuery.data && searchQuery.data.length > 0 && (
          <Paper variant="outlined" sx={{ mt: 1, maxHeight: 240, overflow: "auto" }}>
            {searchQuery.data.map((res) =>
              res.students.map((s) => (
                <Box
                  key={s.student_id}
                  sx={{ p: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                  onClick={() => handleLoad(s.student_id, s.family_id)}
                >
                  <Stack direction="row" justifyContent="space-between">
                    <Box>
                      <Typography fontWeight={600}>{s.student_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.admission_number ? `Adm# ${s.admission_number}  · ` : ""}{s.class_grade_name}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${fmt(res.outstanding)} dues`}
                      size="small"
                      color={res.outstanding > 0 ? "error" : "success"}
                    />
                  </Stack>
                </Box>
              ))
            )}
          </Paper>
        )}
      </Paper>

      {/* Account panel */}
      {account && (
        <Stack spacing={3}>
          {/* Summary strip */}
          <Paper
            sx={{ p: 2, borderRadius: 2, bgcolor: "primary.main", color: "primary.contrastText" }}
          >
            <Stack direction="row" spacing={4} flexWrap="wrap">
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Student</Typography>
                <Typography fontWeight={700}>{account.students.map((s) => s.student_name).join(", ")}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Class</Typography>
                <Typography fontWeight={700}>{account.students[0]?.class_grade_name ?? "—"}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Total Dues</Typography>
                <Typography fontWeight={700}>{fmt(totalDues)}</Typography>
              </Box>
              {account.pending_late_fee > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Late Fee</Typography>
                  <Typography fontWeight={700} color="warning.light">{fmt(account.pending_late_fee)}</Typography>
                </Box>
              )}
            </Stack>
          </Paper>

          {/* Open invoices */}
          {account.open_invoices.length > 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} p={2}>
                Open Invoices — select to pay specific ones
              </Typography>
              <Table size="small">
                <TableHead sx={darkTableHeadSx}>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Month</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {account.open_invoices.map((inv: InvoiceSummary) => (
                    <TableRow
                      key={inv.id}
                      hover
                      selected={selectedInvoices.includes(inv.id)}
                      onClick={() => toggleInvoice(inv.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell padding="checkbox">
                        <input type="checkbox" checked={selectedInvoices.includes(inv.id)} readOnly />
                      </TableCell>
                      <TableCell>{inv.invoice_number}</TableCell>
                      <TableCell>
                        {inv.period_month && inv.period_year
                          ? `${inv.period_month}/${inv.period_year}`
                          : "—"}
                      </TableCell>
                      <TableCell>{inv.due_date}</TableCell>
                      <TableCell align="right">{fmt(inv.net_amount)}</TableCell>
                      <TableCell align="right">{fmt(inv.amount_paid)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>
                        {fmt(inv.balance)}
                      </TableCell>
                      <TableCell>
                        <Chip label={inv.status} size="small" color={STATUS_COLOR[inv.status] ?? "default"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {selectedInvoices.length > 0 && (
                <Box px={2} py={1} bgcolor="action.selected">
                  <Typography variant="body2">
                    Selected {selectedInvoices.length} invoice(s) — total: <strong>{fmt(invoiceTotal)}</strong>
                  </Typography>
                </Box>
              )}
            </Paper>
          )}

          {account.open_invoices.length === 0 && (
            <Alert severity="success" icon={<PersonSearchIcon />}>
              No outstanding dues for this student.
            </Alert>
          )}

          {/* Payment form */}
          {account.open_invoices.length > 0 && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" mb={2}>Record Payment</Typography>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <Button
                    variant={!isPartial ? "contained" : "outlined"}
                    onClick={() => { setIsPartial(false); setAmount(String(totalDues)); }}
                  >
                    Full Payment ({fmt(totalDues)})
                  </Button>
                  <Button
                    variant={isPartial ? "contained" : "outlined"}
                    color="warning"
                    onClick={() => setIsPartial(true)}
                  >
                    Partial Payment
                  </Button>
                </Stack>

                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Amount (PKR)"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    fullWidth
                    disabled={!isPartial}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                      value={method}
                      label="Payment Method"
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    >
                      <MenuItem value="CASH">Cash in Hand</MenuItem>
                      <MenuItem value="BANK">Bank</MenuItem>
                      <MenuItem value="ONLINE">Online Transfer</MenuItem>
                      <MenuItem value="JAZZCASH">JazzCash</MenuItem>
                      <MenuItem value="EASYPAISA">EasyPaisa</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Reference / Note (optional)"
                    value={refNote}
                    onChange={(e) => setRefNote(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Payment Date (back-date optional)"
                    type="date"
                    value={collectedOn}
                    onChange={(e) => setCollectedOn(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}

                <Button
                  variant="contained"
                  size="large"
                  color="success"
                  startIcon={<PaymentsIcon />}
                  onClick={handleReceive}
                  disabled={collect.isPending || !amount || Number(amount) <= 0}
                >
                  {collect.isPending ? "Processing…" : "Receive Payment"}
                </Button>
              </Stack>
            </Paper>
          )}

          {/* Receipt */}
          {lastReceipt && (
            <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "success.main" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReceiptIcon color="success" />
                    <Typography variant="h6">Receipt #{lastReceipt.receipt_number}</Typography>
                  </Stack>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ReceiptIcon />}
                    href={getReceiptPdfUrl(lastReceipt.id)}
                    target="_blank"
                  >
                    Print Receipt
                  </Button>
                </Stack>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={0.5}>
                  <Typography><strong>Amount:</strong> {fmt(lastReceipt.total_amount)}</Typography>
                  <Typography><strong>Method:</strong> {lastReceipt.payment_method}</Typography>
                  <Typography><strong>Date:</strong> {lastReceipt.collected_on}</Typography>
                  <Typography><strong>Collected by:</strong> {lastReceipt.collected_by_name}</Typography>
                </Stack>
                <Divider sx={{ my: 1 }} />
                {lastReceipt.allocations.map((a) => (
                  <Stack key={a.payment_id} direction="row" justifyContent="space-between" py={0.25}>
                    <Typography variant="body2">{a.invoice_number} — {a.student_name}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Typography variant="body2">{fmt(a.amount)}</Typography>
                      <Chip label={a.invoice_status} size="small" color={STATUS_COLOR[a.invoice_status] ?? "default"} />
                    </Stack>
                  </Stack>
                ))}
              </CardContent>
            </Card>
          )}
        </Stack>
      )}
    </AppShell>
  );
}
