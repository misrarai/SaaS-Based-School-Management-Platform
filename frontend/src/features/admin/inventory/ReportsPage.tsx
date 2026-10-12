import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Chip,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listLowStock, listStockLevels, listTransactions } from "../../../api/inventory";
import { InventoryShell, fmtMoney } from "./common";

export function InventoryReportsPage() {
  const [tab, setTab] = useState(0);
  const levels = useQuery({ queryKey: ["inv-stock", ""], queryFn: () => listStockLevels() });
  const low = useQuery({ queryKey: ["inv-low"], queryFn: listLowStock });
  const txns = useQuery({ queryKey: ["inv-txns"], queryFn: () => listTransactions() });

  return (
    <InventoryShell title="Reports">
      <Typography variant="h4" sx={{ mb: 2 }}>Inventory Reports</Typography>
      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tab label={`Stock on hand (${levels.data?.length ?? 0})`} />
          <Tab label={`Low stock (${low.data?.length ?? 0})`} />
          <Tab label={`Transactions (${txns.data?.length ?? 0})`} />
        </Tabs>

        {tab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}><TableRow><TableCell>Item</TableCell><TableCell>Code</TableCell><TableCell>Store</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Reorder</TableCell></TableRow></TableHead>
              <TableBody>
                {(levels.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No stock.</TableCell></TableRow>
                ) : levels.data!.map((l) => (
                  <TableRow key={`${l.item_id}-${l.store_id}`} hover><TableCell>{l.item_name}</TableCell><TableCell>{l.item_code}</TableCell><TableCell>{l.store_name}</TableCell><TableCell align="right">{l.quantity}</TableCell><TableCell align="right">{l.reorder_level}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 1 && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}><TableRow><TableCell>Item</TableCell><TableCell>Category</TableCell><TableCell align="right">In stock</TableCell><TableCell align="right">Reorder</TableCell><TableCell align="right">Shortfall</TableCell></TableRow></TableHead>
              <TableBody>
                {(low.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>Nothing below reorder level.</TableCell></TableRow>
                ) : low.data!.map((r) => (
                  <TableRow key={r.item_id} hover><TableCell>{r.item_name}</TableCell><TableCell>{r.category_name || "—"}</TableCell><TableCell align="right">{r.quantity}</TableCell><TableCell align="right">{r.reorder_level}</TableCell><TableCell align="right">{r.shortfall}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 2 && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}><TableRow><TableCell>#</TableCell><TableCell>Type</TableCell><TableCell>Date</TableCell><TableCell>Store</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
              <TableBody>
                {(txns.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No transactions.</TableCell></TableRow>
                ) : txns.data!.map((t) => (
                  <TableRow key={t.id} hover><TableCell>{t.txn_number}</TableCell><TableCell><Chip size="small" label={t.txn_type} /></TableCell><TableCell>{t.txn_date}</TableCell><TableCell>{t.store_name || "—"}</TableCell><TableCell align="right">{fmtMoney(t.total_amount)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </InventoryShell>
  );
}
