import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Chip,
  Link,
  MenuItem,
  Paper,
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
import { listPayments, type PaymentVerificationStatus } from "../../../api/fees";

const STATUS_COLORS: Record<PaymentVerificationStatus, "warning" | "success" | "error"> = {
  pending: "warning",
  verified: "success",
  rejected: "error",
};

export function PaymentsPage() {
  const [status, setStatus] = useState<PaymentVerificationStatus | "all">("all");
  const paymentsQuery = useQuery({
    queryKey: ["fees-payments", status],
    queryFn: () => listPayments(status === "all" ? undefined : status),
  });

  return (
    <AppShell title="Payments" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Payments
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every payment ever submitted, whatever it's happened to.
      </Typography>

      <TextField
        select
        label="Status"
        size="small"
        value={status}
        onChange={(e) => setStatus(e.target.value as PaymentVerificationStatus | "all")}
        sx={{ mb: 3, minWidth: 200 }}
      >
        <MenuItem value="all">All</MenuItem>
        <MenuItem value="pending">Pending</MenuItem>
        <MenuItem value="verified">Verified</MenuItem>
        <MenuItem value="rejected">Rejected</MenuItem>
      </TextField>

      {paymentsQuery.data?.length === 0 && <Alert severity="info">No payments match this filter.</Alert>}

      {!!paymentsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Invoice #</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentsQuery.data.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{p.student_name}</TableCell>
                  <TableCell>{p.invoice_number}</TableCell>
                  <TableCell>PKR {p.amount.toLocaleString()}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{p.payment_method.replace("_", " ")}</TableCell>
                  <TableCell>{new Date(p.submitted_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.verification_status} color={STATUS_COLORS[p.verification_status]} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell>
                    {p.receipt_image_url ? (
                      <Link href={resolveUploadUrl(p.receipt_image_url)} target="_blank" rel="noopener noreferrer">
                        View
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
