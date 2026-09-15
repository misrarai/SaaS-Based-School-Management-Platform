import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLongOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { resolveUploadUrl } from "../../../api/uploads";
import { listPayments } from "../../../api/fees";

export function ReceiptsPage() {
  const receiptsQuery = useQuery({ queryKey: ["fees-payments", "verified"], queryFn: () => listPayments("verified") });
  const receipts = receiptsQuery.data ?? [];

  return (
    <AppShell title="Receipts" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Receipts
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Proof of every payment that's been verified and counted as paid.
      </Typography>

      {receipts.length === 0 && !receiptsQuery.isLoading && <Alert severity="info">No verified payments yet.</Alert>}

      {receipts.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Invoice #</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Verified</TableCell>
                <TableCell align="right">Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receipts.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{p.student_name}</TableCell>
                  <TableCell>{p.invoice_number}</TableCell>
                  <TableCell>PKR {p.amount.toLocaleString()}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{p.payment_method.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Chip size="small" color="success" label="Paid" />
                      <Typography variant="body2" color="text.secondary">
                        {p.verified_at ? new Date(p.verified_at).toLocaleDateString() : "—"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {p.receipt_image_url ? (
                      <Button
                        size="small"
                        startIcon={<ReceiptLongIcon fontSize="small" />}
                        href={resolveUploadUrl(p.receipt_image_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </Button>
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
