import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Chip,
  Grid,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listInvoices, type InvoiceStatus } from "../../../api/fees";
import { tileColors } from "../../../theme";

const PKR = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const STATUS_COLORS: Record<InvoiceStatus, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  paid: "success",
  overdue: "error",
  waived: "default",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: color, color: "#fff" }}>
      <Typography sx={{ fontSize: 12.5, opacity: 0.9, textTransform: "uppercase" }}>{label}</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{value}</Typography>
    </Paper>
  );
}

export function MyFeesPage() {
  const invoicesQuery = useQuery({ queryKey: ["fees-invoices", "student"], queryFn: () => listInvoices() });
  const invoices = [...(invoicesQuery.data ?? [])].sort((a, b) => b.due_date.localeCompare(a.due_date));
  const outstanding = invoices.filter((i) => i.status === "pending" || i.status === "overdue");
  const outstandingTotal = outstanding.reduce((s, i) => s + i.net_amount, 0);
  const overdueTotal = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.net_amount, 0);
  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.net_amount, 0);

  return (
    <AppShell title="My Fees" navItems={studentNavItems}>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Summary label="Outstanding" value={`PKR ${PKR.format(outstandingTotal)}`} color={tileColors.orange} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Summary label="Overdue" value={`PKR ${PKR.format(overdueTotal)}`} color={tileColors.red} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Summary label="Paid" value={`PKR ${PKR.format(paidTotal)}`} color={tileColors.green} />
        </Grid>
      </Grid>

      {invoicesQuery.isError && <Alert severity="error">Could not load your fee invoices.</Alert>}
      {outstanding.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Payments are made by your parent/guardian from the parent portal or at the school office.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        {invoicesQuery.isLoading && <LinearProgress />}
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Due date</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Discount</TableCell>
              <TableCell align="right">Net</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id} hover>
                <TableCell>{inv.invoice_number}</TableCell>
                <TableCell sx={{ textTransform: "capitalize" }}>{inv.invoice_type}</TableCell>
                <TableCell>{inv.period_month ? `${MONTHS[inv.period_month - 1]} ${inv.period_year}` : "—"}</TableCell>
                <TableCell>{inv.due_date}</TableCell>
                <TableCell align="right">{PKR.format(inv.amount_due)}</TableCell>
                <TableCell align="right">{PKR.format(inv.discount_amount)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {PKR.format(inv.net_amount)}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={inv.status} color={STATUS_COLORS[inv.status]} sx={{ textTransform: "capitalize" }} />
                </TableCell>
              </TableRow>
            ))}
            {!invoicesQuery.isLoading && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </AppShell>
  );
}
