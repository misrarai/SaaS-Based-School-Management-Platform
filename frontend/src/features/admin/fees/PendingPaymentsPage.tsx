import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
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
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { resolveUploadUrl } from "../../../api/uploads";
import { listPendingPayments, verifyPayment, type PaymentDetail } from "../../../api/fees";

function RejectDialog({ payment, onClose }: { payment: PaymentDetail | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const reject = useMutation({
    mutationFn: () => verifyPayment(payment!.id, false, reason || undefined),
    onSuccess: () => {
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["fees-payments-pending"] });
      onClose();
    },
  });

  return (
    <Dialog open={!!payment} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Reject payment</DialogTitle>
      <DialogContent>
        <TextField
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => reject.mutate()} disabled={reject.isPending}>
          Reject
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function PendingPaymentsPage() {
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({ queryKey: ["fees-payments-pending"], queryFn: listPendingPayments });
  const [rejectTarget, setRejectTarget] = useState<PaymentDetail | null>(null);

  const approve = useMutation({
    mutationFn: (paymentId: string) => verifyPayment(paymentId, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fees-payments-pending"] }),
  });

  return (
    <AppShell title="Pending Payments" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Pending Payments
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every payment awaiting a decision, at a glance.
      </Typography>

      {pendingQuery.data?.length === 0 && <Alert severity="info">No payments awaiting verification.</Alert>}

      {!!pendingQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Invoice #</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Receipt</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingQuery.data.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{p.student_name}</TableCell>
                  <TableCell>{p.invoice_number}</TableCell>
                  <TableCell>{new Date(p.submitted_at).toLocaleString()}</TableCell>
                  <TableCell>PKR {p.amount.toLocaleString()}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{p.payment_method.replace("_", " ")}</TableCell>
                  <TableCell>
                    {p.receipt_image_url ? (
                      <Link href={resolveUploadUrl(p.receipt_image_url)} target="_blank" rel="noopener noreferrer">
                        View
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => approve.mutate(p.id)}
                        disabled={approve.isPending}
                      >
                        Approve
                      </Button>
                      <Button size="small" color="error" onClick={() => setRejectTarget(p)}>
                        Reject
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <RejectDialog payment={rejectTarget} onClose={() => setRejectTarget(null)} />
    </AppShell>
  );
}
