import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listMyChildren } from "../../../api/parents";
import {
  initiateJazzCashPayment,
  listInvoices,
  redirectToJazzCashCheckout,
  submitPayment,
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod,
} from "../../../api/fees";

const STATUS_COLORS: Record<InvoiceStatus, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  paid: "success",
  overdue: "error",
  waived: "default",
};

function PayDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("jazzcash");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      submitPayment(
        invoice!.id,
        { amount: Number(amount), payment_method: method, reference_note: reference || undefined },
        receipt ?? undefined,
      ),
    onSuccess: () => {
      setAmount("");
      setReference("");
      setReceipt(null);
      queryClient.invalidateQueries({ queryKey: ["fees-invoices"] });
      onClose();
    },
  });

  const payWithJazzCash = useMutation({
    mutationFn: () => initiateJazzCashPayment(invoice!.id),
    onSuccess: redirectToJazzCashCheckout,
  });

  return (
    <Dialog open={!!invoice} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Pay invoice #{invoice?.invoice_number}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Amount due: PKR {invoice?.net_amount.toLocaleString()}
          </Typography>
          <Button
            variant="contained"
            color="success"
            onClick={() => payWithJazzCash.mutate()}
            disabled={payWithJazzCash.isPending}
          >
            Pay now with JazzCash
          </Button>
          {payWithJazzCash.isError && (
            <Alert severity="error">
              Could not start the JazzCash payment. It may not be configured on the server yet — you can still submit
              a manual payment below.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <Divider sx={{ mx: 3 }}>or submit a manual receipt</Divider>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label="Amount paid (PKR)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              fullWidth
            />
            <FormControl fullWidth required>
              <InputLabel id="method-label">Payment method</InputLabel>
              <Select
                labelId="method-label"
                label="Payment method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                <MenuItem value="jazzcash">JazzCash</MenuItem>
                <MenuItem value="easypaisa">EasyPaisa</MenuItem>
                <MenuItem value="nayapay">NayaPay</MenuItem>
                <MenuItem value="sadapay">SadaPay</MenuItem>
                <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Transaction reference (optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              fullWidth
            />
            <Button component="label" variant="outlined">
              {receipt ? receipt.name : "Upload receipt screenshot (optional)"}
              <input type="file" accept="image/*" hidden onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
            </Button>
            {submit.isError && <Alert severity="error">Could not submit payment.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={submit.isPending}>
            Submit
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

const JAZZCASH_RESULT_MESSAGES: Record<string, { severity: "success" | "error"; text: string }> = {
  success: { severity: "success", text: "Payment received — thank you! Your invoice has been marked paid." },
  failed: { severity: "error", text: "The JazzCash payment was not completed. You can try again or submit a manual receipt." },
  error: { severity: "error", text: "Something went wrong processing the payment result. Please contact the school if you were charged." },
};

export function ParentFeesPage() {
  const queryClient = useQueryClient();
  const childrenQuery = useQuery({ queryKey: ["parents", "me", "children"], queryFn: listMyChildren });
  const invoicesQuery = useQuery({ queryKey: ["fees-invoices", "parent"], queryFn: () => listInvoices() });
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const jazzcashResult = searchParams.get("jazzcash");

  useEffect(() => {
    if (!jazzcashResult) return;
    queryClient.invalidateQueries({ queryKey: ["fees-invoices"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jazzcashResult]);

  const childNameById = Object.fromEntries((childrenQuery.data ?? []).map((c) => [c.id, c.full_name]));

  return (
    <AppShell title="Fees & Receipts" navItems={parentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Fees &amp; Receipts
      </Typography>

      {jazzcashResult && JAZZCASH_RESULT_MESSAGES[jazzcashResult] && (
        <Alert
          severity={JAZZCASH_RESULT_MESSAGES[jazzcashResult].severity}
          sx={{ mb: 3 }}
          onClose={() => setSearchParams({}, { replace: true })}
        >
          {JAZZCASH_RESULT_MESSAGES[jazzcashResult].text}
        </Alert>
      )}

      {invoicesQuery.data?.length === 0 && <Alert severity="info">No invoices yet.</Alert>}

      {!!invoicesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Child</TableCell>
                <TableCell>Invoice #</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Net amount</TableCell>
                <TableCell>Due date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoicesQuery.data.map((inv) => (
                <TableRow key={inv.id} hover>
                  <TableCell>{childNameById[inv.student_id] ?? "—"}</TableCell>
                  <TableCell>{inv.invoice_number}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{inv.invoice_type}</TableCell>
                  <TableCell>PKR {inv.net_amount.toLocaleString()}</TableCell>
                  <TableCell>{inv.due_date}</TableCell>
                  <TableCell>
                    <Chip size="small" label={inv.status} color={STATUS_COLORS[inv.status]} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell align="right">
                    {inv.status !== "paid" && (
                      <Button size="small" variant="contained" onClick={() => setPayTarget(inv)}>
                        Pay / Upload receipt
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <PayDialog invoice={payTarget} onClose={() => setPayTarget(null)} />
    </AppShell>
  );
}
