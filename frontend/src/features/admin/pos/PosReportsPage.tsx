import { useQuery } from "@tanstack/react-query";
import { Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import ReceiptIcon from "@mui/icons-material/ReceiptLongOutlined";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listTransactions, openSaleReceipt } from "../../../api/inventory";
import { PosShell, fmtMoney } from "./common";

export function PosReportsPage() {
  const sales = useQuery({ queryKey: ["pos-sales"], queryFn: () => listTransactions("sale") });

  return (
    <PosShell title="Reports">
      <Typography variant="h4" sx={{ mb: 2 }}>Sales Report</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Receipt #</TableCell><TableCell>Date</TableCell><TableCell>Customer</TableCell>
            <TableCell>Items</TableCell><TableCell align="right">Discount</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Receipt</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {sales.isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
            ) : (sales.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No sales recorded.</TableCell></TableRow>
            ) : sales.data!.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.txn_number}</TableCell>
                <TableCell>{t.txn_date}</TableCell>
                <TableCell>{t.customer_name || t.student_name || "Walk-in"}</TableCell>
                <TableCell>{t.lines.reduce((s, l) => s + l.quantity, 0)} items</TableCell>
                <TableCell align="right">{fmtMoney(t.discount)}</TableCell>
                <TableCell align="right">{fmtMoney(t.total_amount)}</TableCell>
                <TableCell align="right"><Button size="small" startIcon={<ReceiptIcon />} onClick={() => openSaleReceipt(t.id)}>Print</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </PosShell>
  );
}
