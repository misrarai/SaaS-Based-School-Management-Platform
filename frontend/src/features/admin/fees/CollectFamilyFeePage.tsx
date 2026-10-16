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
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroom";
import PaymentsIcon from "@mui/icons-material/Payments";
import ReceiptIcon from "@mui/icons-material/Receipt";
import SearchIcon from "@mui/icons-material/Search";
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
} from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

export function CollectFamilyFeePage() {
  const [searchQ, setSearchQ] = useState("");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [refNote, setRefNote] = useState("");
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = useQuery({
    queryKey: ["counter-search-family", searchQ],
    queryFn: () => searchCounter(searchQ),
    enabled: searchQ.length >= 1,
  });

  const accountQuery = useQuery({
    queryKey: ["counter-account-family", selectedFamilyId],
    queryFn: () => getCounterAccount({ family_id: selectedFamilyId! }),
    enabled: !!selectedFamilyId,
  });

  const account: CounterAccount | undefined = accountQuery.data;

  const collect = useMutation({
    mutationFn: () =>
      collectPayment({
        family_id: selectedFamilyId!,
        amount: Number(amount),
        payment_method: method,
        reference_note: refNote || undefined,
      }),
    onSuccess: (receipt) => {
      setLastReceipt(receipt);
      setAmount("");
      setRefNote("");
      accountQuery.refetch();
      setError(null);
    },
    onError: () => setError("Failed to collect payment."),
  });

  const loadFamily = (familyId: string, outstanding: number) => {
    setSelectedFamilyId(familyId);
    setAmount(String(outstanding));
    setLastReceipt(null);
    setSearchQ("");
  };

  return (
    <AppShell title="Collect Family Fee" navItems={adminNavItems}>
      <Stack direction="row" spacing={1} alignItems="center" mb={3}>
        <FamilyRestroomIcon color="primary" />
        <Typography variant="h4">Collect Family Fee</Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Search for a family and collect fees for all children in a single transaction.
      </Typography>

      {/* Search */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by family name, student name or admission number…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "text.disabled" }} /> }}
          size="small"
        />

        {searchQ.length >= 1 && searchQuery.data && searchQuery.data.length > 0 && (
          <Paper variant="outlined" sx={{ mt: 1, maxHeight: 280, overflow: "auto" }}>
            {searchQuery.data
              .filter((res) => res.family_id)
              .map((res) => (
                <Box
                  key={res.family_id}
                  sx={{ p: 2, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                  onClick={() => loadFamily(res.family_id!, res.outstanding)}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography fontWeight={600}>
                        {res.family_name ?? `Family #${res.family_number}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {res.students.length} student(s): {res.students.map((s) => s.student_name).join(", ")}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${fmt(res.outstanding)} dues`}
                      size="small"
                      color={res.outstanding > 0 ? "error" : "success"}
                    />
                  </Stack>
                </Box>
              ))}
            {searchQuery.data.filter((r) => r.family_id).length === 0 && (
              <Box p={2}>
                <Typography color="text.secondary" variant="body2">
                  No family accounts found. Family-wise collection requires students linked to a family.
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Paper>

      {/* Family account */}
      {account && (
        <Stack spacing={3}>
          {/* Family summary strip */}
          <Paper sx={{ p: 2, borderRadius: 2, bgcolor: "secondary.main", color: "secondary.contrastText" }}>
            <Stack direction="row" spacing={4} flexWrap="wrap">
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Family</Typography>
                <Typography fontWeight={700}>
                  {account.family_name ?? `Family #${account.family_number}`}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Children</Typography>
                <Typography fontWeight={700}>{account.students.length}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Total Outstanding</Typography>
                <Typography fontWeight={700}>{fmt(account.total_outstanding)}</Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Per-student dues */}
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} p={2}>
              Family Members — Outstanding Invoices
            </Typography>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Admission #</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {account.open_invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="success.main" py={2}>No outstanding dues for this family.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  account.open_invoices.map((inv) => (
                    <TableRow key={inv.id} hover>
                      <TableCell>{inv.student_name}</TableCell>
                      <TableCell>{inv.admission_number ?? "—"}</TableCell>
                      <TableCell>{inv.class_grade_name}</TableCell>
                      <TableCell>{inv.invoice_number}</TableCell>
                      <TableCell>
                        {inv.period_month && inv.period_year ? `${inv.period_month}/${inv.period_year}` : "—"}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>
                        {fmt(inv.balance)}
                      </TableCell>
                      <TableCell>
                        <Chip label={inv.status} size="small" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>

          {account.open_invoices.length > 0 && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" mb={2}>Collect Family Payment</Typography>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Amount (PKR)"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    fullWidth
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
                  <TextField
                    label="Reference (optional)"
                    value={refNote}
                    onChange={(e) => setRefNote(e.target.value)}
                    fullWidth
                  />
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}

                <Button
                  variant="contained"
                  size="large"
                  color="success"
                  startIcon={<PaymentsIcon />}
                  onClick={() => collect.mutate()}
                  disabled={collect.isPending || !amount || Number(amount) <= 0}
                >
                  {collect.isPending ? "Processing…" : `Receive Family Payment (${fmt(Number(amount) || 0)})`}
                </Button>
              </Stack>
            </Paper>
          )}

          {lastReceipt && (
            <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "success.main" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReceiptIcon color="success" />
                    <Typography variant="h6">Family Receipt #{lastReceipt.receipt_number}</Typography>
                  </Stack>
                  <Button
                    variant="outlined"
                    size="small"
                    href={getReceiptPdfUrl(lastReceipt.id)}
                    target="_blank"
                  >
                    Print Receipt
                  </Button>
                </Stack>
                <Divider sx={{ mb: 1 }} />
                <Typography><strong>Total:</strong> {fmt(lastReceipt.total_amount)}</Typography>
                <Typography><strong>Method:</strong> {lastReceipt.payment_method}</Typography>
                <Divider sx={{ my: 1 }} />
                {lastReceipt.allocations.map((a) => (
                  <Stack key={a.payment_id} direction="row" justifyContent="space-between" py={0.25}>
                    <Typography variant="body2">{a.student_name} — {a.invoice_number}</Typography>
                    <Typography variant="body2">{fmt(a.amount)}</Typography>
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
