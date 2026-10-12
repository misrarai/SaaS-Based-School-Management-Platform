import { useQuery } from "@tanstack/react-query";
import {
  Box,
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
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listAssets, listItems, listLowStock, listStores, listTransactions } from "../../../api/inventory";
import { InventoryShell, StatTile, fmtMoney } from "./common";

export function InventoryDashboardPage() {
  const items = useQuery({ queryKey: ["inv-items"], queryFn: () => listItems() });
  const stores = useQuery({ queryKey: ["inv-stores"], queryFn: listStores });
  const low = useQuery({ queryKey: ["inv-low"], queryFn: listLowStock });
  const assets = useQuery({ queryKey: ["inv-assets", "active"], queryFn: () => listAssets("active") });
  const txns = useQuery({ queryKey: ["inv-txns"], queryFn: () => listTransactions() });

  const bookValue = (assets.data ?? []).reduce((s, a) => s + a.book_value, 0);

  return (
    <InventoryShell title="Dashboard">
      <Typography variant="h4" sx={{ mb: 2 }}>Inventory Dashboard</Typography>

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2, mb: 3 }}>
        <StatTile label="Items" value={items.data?.length ?? "—"} color="#2563eb" />
        <StatTile label="Stores" value={stores.data?.length ?? "—"} />
        <StatTile label="Low stock" value={low.data?.length ?? "—"} color="#dc2626" />
        <StatTile label="Active assets" value={assets.data?.length ?? "—"} color="#7c3aed" />
        <StatTile label="Asset book value" value={assets.data ? fmtMoney(bookValue) : "—"} color="#059669" />
        <StatTile label="Transactions" value={txns.data?.length ?? "—"} />
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, alignItems: "start" }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Typography variant="h6" sx={{ p: 2, pb: 1, color: "error.main" }}>Low stock alerts</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}><TableRow><TableCell>Item</TableCell><TableCell align="right">In stock</TableCell><TableCell align="right">Reorder</TableCell><TableCell align="right">Short</TableCell></TableRow></TableHead>
              <TableBody>
                {(low.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>Everything is above reorder level. 🎉</TableCell></TableRow>
                ) : low.data!.map((r) => (
                  <TableRow key={r.item_id} hover><TableCell>{r.item_name}</TableCell><TableCell align="right">{r.quantity}</TableCell><TableCell align="right">{r.reorder_level}</TableCell><TableCell align="right">{r.shortfall}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Typography variant="h6" sx={{ p: 2, pb: 1 }}>Recent transactions</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}><TableRow><TableCell>#</TableCell><TableCell>Type</TableCell><TableCell>Date</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
              <TableBody>
                {(txns.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>No transactions yet.</TableCell></TableRow>
                ) : txns.data!.slice(0, 8).map((t) => (
                  <TableRow key={t.id} hover><TableCell>{t.txn_number}</TableCell><TableCell>{t.txn_type}</TableCell><TableCell>{t.txn_date}</TableCell><TableCell align="right">{fmtMoney(t.total_amount)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </InventoryShell>
  );
}
