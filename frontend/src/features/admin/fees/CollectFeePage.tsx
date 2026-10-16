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
  InputAdornment,
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonIcon from "@mui/icons-material/Person";
import PrintIcon from "@mui/icons-material/Print";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  searchCounter,
  getCounterAccount,
  collectPayment,
  getReceiptPdfUrl,
  type PaymentMethod,
  type Receipt,
  type InvoiceSummary,
} from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  pending: "warning", partial: "warning", paid: "success", overdue: "error", cancelled: "default",
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank Transfer" },
  { value: "ONLINE", label: "Online Transfer" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "EASYPAISA", label: "EasyPaisa" },
];

export function CollectFeePage() {
  const [searchQ, setSearchQ] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [isPartial, setIsPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [refNote, setRefNote] = useState("");
  const [collectedOn, setCollectedOn] = useState("");
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = useQuery({
    queryKey: ["counter-search", searchQ],
    queryFn: () => searchCounter(searchQ),
    enabled: searchQ.length >= 1,
  });

  const accountQuery = useQuery({
    queryKey: ["counter-account", selectedStudentId, selectedFamilyId],
    queryFn: () =>
      getCounterAccount(selectedFamilyId ? { family_id: selectedFamilyId } : { student_id: selectedStudentId! }),
    enabled: !!(selectedStudentId || selectedFamilyId),
  });

  const account = accountQuery.data;
  const openInvoices = account?.open_invoices ?? [];
  const totalDues = account?.total_outstanding ?? 0;

  const invoiceTotal = openInvoices
    .filter((inv) => selectedInvoices.includes(inv.id))
    .reduce((s, inv) => s + inv.balance, 0);

  const collectMutation = useMutation({
    mutationFn: () =>
      collectPayment({
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
      setSelectedInvoices([]);
      setIsPartial(false);
      accountQuery.refetch();
      setError(null);
    },
    onError: () => setError("Payment failed. Please check details and try again."),
  });

  const handleSelect = (studentId: string, familyId: string | null, outstanding: number) => {
    setSelectedStudentId(studentId);
    setSelectedFamilyId(familyId);
    setLastReceipt(null);
    setSearchQ("");
    setSelectedInvoices([]);
    setIsPartial(false);
    setAmount(String(outstanding));
    setError(null);
  };

  const handleFullPayment = () => {
    setIsPartial(false);
    setAmount(String(selectedInvoices.length ? invoiceTotal : totalDues));
  };

  const toggleInvoice = (inv: InvoiceSummary) => {
    setSelectedInvoices((prev) => {
      const next = prev.includes(inv.id) ? prev.filter((i) => i !== inv.id) : [...prev, inv.id];
      if (!isPartial) setAmount(String(next.length ? openInvoices.filter(i => next.includes(i.id)).reduce((s, i) => s + i.balance, 0) : totalDues));
      return next;
    });
  };

  const hasAccount = !!account;

  return (
    <AppShell title="Collect Fee" navItems={adminNavItems}>
      <Typography variant="h4" fontWeight={800} mb={0.5}>Collect Fee</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Search a student by name or admission number, then record their payment.
      </Typography>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="flex-start">
        {/* ── LEFT PANEL: Search + Student Info ── */}
        <Box sx={{ width: { xs: "100%", lg: 380 }, flexShrink: 0 }}>
          {/* Search */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
              Search Student
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Name or admission number…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            {/* Search results dropdown */}
            {searchQ.length >= 1 && searchQuery.data && searchQuery.data.length > 0 && (
              <Paper variant="outlined" sx={{ mt: 1, borderRadius: 2, overflow: "hidden" }}>
                {searchQuery.data.map((res) =>
                  res.students.map((s) => (
                    <Box
                      key={s.student_id}
                      sx={{
                        px: 2,
                        py: 1.25,
                        cursor: "pointer",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        "&:last-child": { borderBottom: "none" },
                        "&:hover": { bgcolor: "primary.50" },
                      }}
                      onClick={() => handleSelect(s.student_id, s.family_id, res.outstanding)}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography fontWeight={600} fontSize={14}>{s.student_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {s.admission_number ? `Adm# ${s.admission_number} · ` : ""}{s.class_grade_name}
                          </Typography>
                        </Box>
                        <Chip
                          label={res.outstanding > 0 ? fmt(res.outstanding) : "Paid"}
                          size="small"
                          color={res.outstanding > 0 ? "error" : "success"}
                          sx={{ fontWeight: 700 }}
                        />
                      </Stack>
                    </Box>
                  ))
                )}
              </Paper>
            )}

            {searchQ.length >= 1 && searchQuery.data?.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                No students found.
              </Typography>
            )}
          </Paper>

          {/* Student Info Card */}
          {hasAccount && (
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
              <Box sx={{ bgcolor: "primary.main", px: 2.5, py: 2, color: "#fff" }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <PersonIcon />
                  </Box>
                  <Box>
                    <Typography fontWeight={700} fontSize={15}>
                      {account.students.map((s) => s.student_name).join(", ")}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>
                      {account.students[0]?.class_grade_name ?? ""}
                      {account.students[0]?.admission_number ? ` · Adm# ${account.students[0].admission_number}` : ""}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
              <Box px={2.5} py={2}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Total Outstanding</Typography>
                    <Typography fontWeight={700} color={totalDues > 0 ? "error.main" : "success.main"}>
                      {fmt(totalDues)}
                    </Typography>
                  </Stack>
                  {account.pending_late_fee > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Late Fee</Typography>
                      <Typography fontWeight={600} color="warning.main">{fmt(account.pending_late_fee)}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Open Invoices</Typography>
                    <Typography fontWeight={600}>{openInvoices.length}</Typography>
                  </Stack>
                </Stack>
              </Box>
            </Paper>
          )}

          {/* Receipt after payment */}
          {lastReceipt && (
            <Paper
              variant="outlined"
              sx={{ mt: 2, borderRadius: 3, borderColor: "success.main", borderWidth: 2, overflow: "hidden" }}
            >
              <Box sx={{ bgcolor: "success.main", px: 2.5, py: 1.5, color: "#fff" }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleIcon fontSize="small" />
                  <Typography fontWeight={700}>Payment Received</Typography>
                </Stack>
              </Box>
              <Box px={2.5} py={2}>
                <Stack spacing={0.75} mb={1.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Receipt #</Typography>
                    <Typography fontWeight={700}>{lastReceipt.receipt_number}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Amount</Typography>
                    <Typography fontWeight={700} color="success.main">{fmt(lastReceipt.total_amount)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Method</Typography>
                    <Typography fontWeight={600}>{lastReceipt.payment_method}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Date</Typography>
                    <Typography>{lastReceipt.collected_on}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Collected by</Typography>
                    <Typography>{lastReceipt.collected_by_name}</Typography>
                  </Stack>
                </Stack>
                <Button
                  fullWidth
                  variant="outlined"
                  color="success"
                  startIcon={<PrintIcon />}
                  href={getReceiptPdfUrl(lastReceipt.id)}
                  target="_blank"
                  size="small"
                >
                  Print Receipt PDF
                </Button>
              </Box>
            </Paper>
          )}
        </Box>

        {/* ── RIGHT PANEL: Invoices + Payment Form ── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!hasAccount && (
            <Paper
              variant="outlined"
              sx={{ borderRadius: 3, p: 6, textAlign: "center", borderStyle: "dashed" }}
            >
              <SearchIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1.5 }} />
              <Typography variant="h6" color="text.secondary" fontWeight={600}>
                Search for a student
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Enter a name or admission number on the left to load their fee account.
              </Typography>
            </Paper>
          )}

          {hasAccount && openInvoices.length === 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 3, p: 6, textAlign: "center" }}>
              <CheckCircleIcon sx={{ fontSize: 56, color: "success.main", mb: 1.5 }} />
              <Typography variant="h6" fontWeight={600} color="success.main">All Clear!</Typography>
              <Typography variant="body2" color="text.secondary">No outstanding dues for this student.</Typography>
            </Paper>
          )}

          {hasAccount && openInvoices.length > 0 && (
            <Stack spacing={2.5}>
              {/* Invoice list */}
              <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
                <Box px={2.5} py={1.75} sx={{ bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={700}>Open Invoices</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Click rows to select specific invoices
                    </Typography>
                  </Stack>
                </Box>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>Invoice #</TableCell>
                      <TableCell>Period</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {openInvoices.map((inv: InvoiceSummary) => {
                      const sel = selectedInvoices.includes(inv.id);
                      return (
                        <TableRow
                          key={inv.id}
                          hover
                          selected={sel}
                          onClick={() => toggleInvoice(inv)}
                          sx={{ cursor: "pointer", bgcolor: sel ? "primary.50" : undefined }}
                        >
                          <TableCell padding="checkbox">
                            <Box
                              sx={{
                                width: 18, height: 18, borderRadius: "4px", border: "2px solid",
                                borderColor: sel ? "primary.main" : "grey.400",
                                bgcolor: sel ? "primary.main" : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center", mx: 1,
                              }}
                            >
                              {sel && <CheckCircleIcon sx={{ fontSize: 12, color: "#fff" }} />}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{inv.invoice_number}</TableCell>
                          <TableCell>
                            {inv.period_month ? `${MONTHS[inv.period_month]} ${inv.period_year}` : "—"}
                          </TableCell>
                          <TableCell>{inv.due_date}</TableCell>
                          <TableCell align="right">{fmt(inv.net_amount)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>
                            {fmt(inv.balance)}
                          </TableCell>
                          <TableCell>
                            <Chip label={inv.status} size="small" color={STATUS_COLOR[inv.status] ?? "default"} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {selectedInvoices.length > 0 && (
                  <Box px={2.5} py={1.25} sx={{ bgcolor: "primary.50", borderTop: "1px solid", borderColor: "primary.200" }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="primary.main">
                        {selectedInvoices.length} invoice{selectedInvoices.length > 1 ? "s" : ""} selected
                      </Typography>
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        Total: {fmt(invoiceTotal)}
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </Paper>

              {/* Payment form */}
              <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
                <Box px={2.5} py={1.75} sx={{ bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
                  <Typography fontWeight={700}>Record Payment</Typography>
                </Box>
                <Box p={2.5}>
                  <Stack spacing={2.5}>
                    {/* Full / Partial toggle */}
                    <Stack direction="row" spacing={1.5}>
                      <Button
                        variant={!isPartial ? "contained" : "outlined"}
                        onClick={handleFullPayment}
                        sx={{ flex: 1, borderRadius: 2, py: 1 }}
                      >
                        Full Payment
                        <Typography variant="caption" sx={{ ml: 0.75, opacity: 0.85 }}>
                          {fmt(selectedInvoices.length ? invoiceTotal : totalDues)}
                        </Typography>
                      </Button>
                      <Button
                        variant={isPartial ? "contained" : "outlined"}
                        color="warning"
                        onClick={() => setIsPartial(true)}
                        sx={{ flex: 1, borderRadius: 2, py: 1 }}
                      >
                        Partial Payment
                      </Button>
                    </Stack>

                    <Divider />

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        label="Amount (PKR)"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={!isPartial}
                        fullWidth
                        required
                        InputProps={{
                          startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                          inputProps: { min: 1 },
                        }}
                      />
                      <FormControl fullWidth>
                        <InputLabel>Payment Method</InputLabel>
                        <Select
                          value={method}
                          label="Payment Method"
                          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        label="Reference / Cheque No. (optional)"
                        value={refNote}
                        onChange={(e) => setRefNote(e.target.value)}
                        fullWidth
                        size="small"
                      />
                      <TextField
                        label="Payment Date"
                        type="date"
                        value={collectedOn}
                        onChange={(e) => setCollectedOn(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        size="small"
                        helperText="Leave blank for today"
                      />
                    </Stack>

                    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

                    <Button
                      variant="contained"
                      size="large"
                      color="success"
                      fullWidth
                      startIcon={<PaymentsIcon />}
                      onClick={() => collectMutation.mutate()}
                      disabled={collectMutation.isPending || !amount || Number(amount) <= 0}
                      sx={{ py: 1.5, borderRadius: 2, fontSize: 16, fontWeight: 700 }}
                    >
                      {collectMutation.isPending
                        ? "Processing…"
                        : `Receive ${amount ? fmt(Number(amount)) : "Payment"}`}
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            </Stack>
          )}
        </Box>
      </Stack>
    </AppShell>
  );
}
