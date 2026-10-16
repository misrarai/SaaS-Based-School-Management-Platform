import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
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
import DeleteIcon from "@mui/icons-material/Delete";
import ReceiptIcon from "@mui/icons-material/ReceiptLongOutlined";
import { createSale, listItems, listStores, openSaleReceipt, type Item } from "../../../api/inventory";
import { PosShell, PageHeader, fmtMoney, apiErrorMessage, todayIso } from "./common";

interface CartLine { item: Item; qty: number; price: number }

export function SaleTerminalPage() {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("");
  const [notice, setNotice] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  const stores = useQuery({ queryKey: ["inv-stores"], queryFn: listStores });
  const items = useQuery({ queryKey: ["inv-items"], queryFn: () => listItems() });

  const effectiveStore = storeId || stores.data?.[0]?.id || "";

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.qty * l.price, 0), [cart]);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const change = Math.max(0, (Number(paid) || 0) - total);

  const addItem = (item: Item | null) => {
    if (!item) return;
    setCart((c) => {
      const existing = c.find((l) => l.item.id === item.id);
      if (existing) return c.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { item, qty: 1, price: item.sale_price ?? 0 }];
    });
  };
  const setQty = (id: string, qty: number) => setCart((c) => c.map((l) => (l.item.id === id ? { ...l, qty } : l)));
  const setPrice = (id: string, price: number) => setCart((c) => c.map((l) => (l.item.id === id ? { ...l, price } : l)));

  const sale = useMutation({
    mutationFn: () =>
      createSale({
        store_id: effectiveStore,
        txn_date: todayIso(),
        customer_name: customer || "Walk-in",
        payment_method: "cash",
        discount: Number(discount) || 0,
        amount_paid: paid ? Number(paid) : total,
        lines: cart.map((l) => ({ item_id: l.item.id, quantity: l.qty, unit_price: l.price })),
      }),
    onSuccess: async (txn) => {
      setNotice({ type: "success", msg: `Sale ${txn.txn_number} recorded — total ${fmtMoney(total)}.` });
      setCart([]); setCustomer(""); setDiscount("0"); setPaid("");
      qc.invalidateQueries({ queryKey: ["inv-items"] });
      qc.invalidateQueries({ queryKey: ["pos-sales"] });
      await openSaleReceipt(txn.id).catch(() => {});
    },
    onError: (e) => setNotice({ type: "error", msg: apiErrorMessage(e, "Could not record the sale.") }),
  });

  return (
    <PosShell title="Sale">
      <PageHeader title="Point of Sale" />
      {notice && <Alert severity={notice.type} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.msg}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 360px" }, gap: 2, alignItems: "start" }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField select size="small" label="Store" value={effectiveStore} onChange={(e) => setStoreId(e.target.value)} sx={{ minWidth: 180 }}>
              {(stores.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <Autocomplete
              fullWidth size="small" options={items.data ?? []} value={null} blurOnSelect
              getOptionLabel={(i) => `${i.name} (${i.code}) · ${fmtMoney(i.sale_price ?? 0)}`}
              onChange={(_, v) => addItem(v)}
              renderInput={(params) => <TextField {...params} label="Add product…" placeholder="Scan or search" />}
            />
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Item</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Price</TableCell>
                <TableCell align="right">Total</TableCell><TableCell />
              </TableRow></TableHead>
              <TableBody>
                {cart.length === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>Cart is empty — add products above.</TableCell></TableRow>
                ) : cart.map((l) => (
                  <TableRow key={l.item.id}>
                    <TableCell>{l.item.name}<div style={{ color: "#667085", fontSize: 12 }}>{l.item.current_stock} in stock</div></TableCell>
                    <TableCell align="right" width={90}><TextField size="small" type="number" value={l.qty} onChange={(e) => setQty(l.item.id, Number(e.target.value))} /></TableCell>
                    <TableCell align="right" width={110}><TextField size="small" type="number" value={l.price} onChange={(e) => setPrice(l.item.id, Number(e.target.value))} /></TableCell>
                    <TableCell align="right">{fmtMoney(l.qty * l.price)}</TableCell>
                    <TableCell><IconButton size="small" color="error" onClick={() => setCart((c) => c.filter((x) => x.item.id !== l.item.id))}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Checkout</Typography>
          <Stack spacing={2}>
            <TextField size="small" label="Customer (optional)" placeholder="Walk-in" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Subtotal</span><strong>{fmtMoney(subtotal)}</strong></Stack>
            <TextField size="small" type="number" label="Discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Divider />
            <Stack direction="row" sx={{ justifyContent: "space-between", fontSize: 20 }}><span>Total</span><strong>{fmtMoney(total)}</strong></Stack>
            <TextField size="small" type="number" label="Amount paid (cash)" value={paid} onChange={(e) => setPaid(e.target.value)} />
            <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Change</span><strong>{fmtMoney(change)}</strong></Stack>
            <Button variant="contained" size="large" startIcon={<ReceiptIcon />} disabled={cart.length === 0 || !effectiveStore || sale.isPending} onClick={() => sale.mutate()}>
              {sale.isPending ? "Processing…" : "Complete Sale"}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </PosShell>
  );
}
