import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Chip,
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
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listPayouts, type PayoutStatus } from "../../../api/payouts";

const STATUS_COLORS: Record<PayoutStatus, "warning" | "success" | "default"> = {
  draft: "default",
  approved: "warning",
  paid: "success",
};

export function MyPayoutsPage() {
  const payoutsQuery = useQuery({ queryKey: ["payouts", "teacher"], queryFn: listPayouts });

  return (
    <AppShell title="My Payouts" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        My Payouts
      </Typography>

      {payoutsQuery.data?.length === 0 && <Alert severity="info">No payouts recorded yet.</Alert>}

      {!!payoutsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Sessions delivered</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payoutsQuery.data.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    {p.period_month}/{p.period_year}
                  </TableCell>
                  <TableCell>{p.sessions_delivered}</TableCell>
                  <TableCell>PKR {p.calculated_amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.status} color={STATUS_COLORS[p.status]} sx={{ textTransform: "capitalize" }} />
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
