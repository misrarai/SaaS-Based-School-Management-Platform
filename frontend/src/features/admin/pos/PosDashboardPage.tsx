import { useQuery } from "@tanstack/react-query";
import { Button, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Box } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listTransactions } from "../../../api/inventory";
import { PosShell, fmtMoney, todayIso } from "./common";

function Tile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: "1 1 160px", minWidth: 160 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box sx={{ fontSize: 28, fontWeight: 700, color: color ?? "inherit" }}>{value}</Box>
    </Paper>
  );
}

export function PosDashboardPage() {
  const sales = useQuery({ queryKey: ["pos-sales"], queryFn: () => listTransactions("sale") });
  const list = sales.data ?? [];
  const today = todayIso();
  const todays = list.filter((t) => t.txn_date === today);
  const todayTotal = todays.reduce((s, t) => s + t.total_amount, 0);
  const allTotal = list.reduce((s, t) => s + t.total_amount, 0);

  return (
    <PosShell title="Dashboard">
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Point of Sale</Typography>
        <Button component={RouterLink} to="/admin/pos/sale" variant="contained" startIcon={<PointOfSaleIcon />}>New Sale</Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Tile label="Sales today" value={todays.length} color="#2563eb" />
        <Tile label="Revenue today" value={fmtMoney(todayTotal)} color="#059669" />
        <Tile label="Total sales" value={list.length} />
        <Tile label="Total revenue" value={fmtMoney(allTotal)} color="#7c3aed" />
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>Recent sales</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Receipt #</TableCell><TableCell>Date</TableCell><TableCell>Customer</TableCell>
            <TableCell>Store</TableCell><TableCell align="right">Amount</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {sales.isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
            ) : list.length === 0 ? (
              <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No sales yet.</TableCell></TableRow>
            ) : list.slice(0, 10).map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.txn_number}</TableCell>
                <TableCell>{t.txn_date}</TableCell>
                <TableCell>{t.customer_name || t.student_name || "Walk-in"}</TableCell>
                <TableCell>{t.store_name || "—"}</TableCell>
                <TableCell align="right">{fmtMoney(t.total_amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </PosShell>
  );
}
