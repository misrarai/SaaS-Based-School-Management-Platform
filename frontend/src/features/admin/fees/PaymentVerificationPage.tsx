import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { resolveUploadUrl } from "../../../api/uploads";
import { listPendingPayments, verifyPayment, type PaymentDetail } from "../../../api/fees";

const METHOD_LABELS: Record<string, string> = {
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  nayapay: "NayaPay",
  sadapay: "SadaPay",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  other: "Other",
};

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
      <DialogTitle>Reject payment — {payment?.student_name}</DialogTitle>
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

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(url);
}

export function PaymentVerificationPage() {
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({ queryKey: ["fees-payments-pending"], queryFn: listPendingPayments });
  const [rejectTarget, setRejectTarget] = useState<PaymentDetail | null>(null);

  const approve = useMutation({
    mutationFn: (paymentId: string) => verifyPayment(paymentId, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fees-payments-pending"] }),
  });

  const pending = pendingQuery.data ?? [];

  return (
    <AppShell title="Payment Verification" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Payment Verification
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review each payment screenshot and confirm it before it counts as paid.
      </Typography>

      {pending.length === 0 && !pendingQuery.isLoading && (
        <Alert severity="success">Nothing to review — every payment has been verified or rejected.</Alert>
      )}

      <Grid container spacing={2}>
        {pending.map((p) => (
          <Grid key={p.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              {p.receipt_image_url && isImageUrl(p.receipt_image_url) && (
                <CardMedia
                  component="img"
                  image={resolveUploadUrl(p.receipt_image_url)}
                  alt="Payment screenshot"
                  sx={{ height: 180, objectFit: "cover", bgcolor: "action.hover" }}
                />
              )}
              <CardContent sx={{ flexGrow: 1 }}>
                <Chip size="small" color="warning" label="Payment Pending" sx={{ mb: 2, fontWeight: 600 }} />

                <Stack spacing={1} divider={<Divider />}>
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography color="text.secondary">Student</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{p.student_name}</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography color="text.secondary">Amount</Typography>
                    <Typography sx={{ fontWeight: 700 }}>PKR {p.amount.toLocaleString()}</Typography>
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography color="text.secondary">Method</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{METHOD_LABELS[p.payment_method] ?? p.payment_method}</Typography>
                  </Stack>
                  {p.reference_note && (
                    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                      <Typography color="text.secondary">Reference</Typography>
                      <Typography>{p.reference_note}</Typography>
                    </Stack>
                  )}
                  {p.receipt_image_url && !isImageUrl(p.receipt_image_url) && (
                    <Box>
                      <a href={resolveUploadUrl(p.receipt_image_url)} target="_blank" rel="noopener noreferrer">
                        View uploaded receipt
                      </a>
                    </Box>
                  )}
                  {!p.receipt_image_url && (
                    <Typography color="text.secondary" sx={{ fontStyle: "italic" }}>
                      No screenshot uploaded
                    </Typography>
                  )}
                </Stack>

                <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    onClick={() => approve.mutate(p.id)}
                    disabled={approve.isPending}
                  >
                    Approve
                  </Button>
                  <Button fullWidth variant="outlined" color="error" onClick={() => setRejectTarget(p)}>
                    Reject
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <RejectDialog payment={rejectTarget} onClose={() => setRejectTarget(null)} />
    </AppShell>
  );
}
