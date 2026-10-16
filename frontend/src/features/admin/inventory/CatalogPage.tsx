import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createCategory, createItem, createSupplier, createUnit, deleteCategory, deleteUnit,
  listCategories, listItems, listSuppliers, listUnits, updateItem,
} from "../../../api/inventory";
import { InventoryShell, PageHeader, apiErrorMessage, fmtMoney } from "./common";

export function CatalogPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [itemDlg, setItemDlg] = useState(false);
  const [itemForm, setItemForm] = useState({ id: "", name: "", code: "", category_id: "", unit_id: "", reorder_level: "0", sale_price: "" });
  const [masterName, setMasterName] = useState("");
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", contact_person: "" });
  const [error, setError] = useState<string | null>(null);

  const items = useQuery({ queryKey: ["inv-items"], queryFn: () => listItems() });
  const cats = useQuery({ queryKey: ["inv-cats"], queryFn: listCategories });
  const units = useQuery({ queryKey: ["inv-units"], queryFn: listUnits });
  const suppliers = useQuery({ queryKey: ["inv-suppliers"], queryFn: listSuppliers });
  const inv = (k: string) => qc.invalidateQueries({ queryKey: [k] });

  const saveItem = useMutation({
    mutationFn: () => {
      const p = {
        name: itemForm.name, code: itemForm.code || undefined,
        category_id: itemForm.category_id || null, unit_id: itemForm.unit_id || null,
        reorder_level: Number(itemForm.reorder_level) || 0,
        sale_price: itemForm.sale_price ? Number(itemForm.sale_price) : null,
      };
      return itemForm.id ? updateItem(itemForm.id, p) : createItem(p);
    },
    onSuccess: () => { setItemDlg(false); inv("inv-items"); },
    onError: (e) => setError(apiErrorMessage(e, "Could not save item.")),
  });
  const addCat = useMutation({ mutationFn: () => createCategory({ name: masterName.trim() }), onSuccess: () => { setMasterName(""); inv("inv-cats"); } });
  const addUnit = useMutation({ mutationFn: () => createUnit({ name: masterName.trim() }), onSuccess: () => { setMasterName(""); inv("inv-units"); } });
  const addSupplier = useMutation({ mutationFn: () => createSupplier(supplierForm), onSuccess: () => { setSupplierForm({ name: "", phone: "", email: "", contact_person: "" }); inv("inv-suppliers"); } });
  const delCat = useMutation({ mutationFn: (id: string) => deleteCategory(id), onSuccess: () => inv("inv-cats") });
  const delUnit = useMutation({ mutationFn: (id: string) => deleteUnit(id), onSuccess: () => inv("inv-units") });

  const openItem = (it?: typeof itemForm) => {
    setError(null);
    setItemForm(it ?? { id: "", name: "", code: "", category_id: "", unit_id: "", reorder_level: "0", sale_price: "" });
    setItemDlg(true);
  };

  return (
    <InventoryShell title="Catalog">
      <PageHeader title="Catalog" actions={tab === 0 ? <Button variant="contained" startIcon={<AddIcon />} onClick={() => openItem()}>New Item</Button> : undefined} />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Items" />
        <Tab label="Categories" />
        <Tab label="Units" />
        <Tab label="Suppliers" />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={darkTableHeadSx}><TableRow>
              <TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Category</TableCell>
              <TableCell>Unit</TableCell><TableCell align="right">Reorder</TableCell><TableCell align="right">Price</TableCell>
              <TableCell align="right">In stock</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(items.data?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={8} sx={{ color: "text.secondary" }}>No items yet.</TableCell></TableRow>
              ) : items.data!.map((it) => (
                <TableRow key={it.id} hover>
                  <TableCell>{it.code}</TableCell>
                  <TableCell>{it.name}{!it.is_active && <Chip size="small" label="inactive" sx={{ ml: 1 }} />}</TableCell>
                  <TableCell>{it.category_name || "—"}</TableCell>
                  <TableCell>{it.unit_name || "—"}</TableCell>
                  <TableCell align="right">{it.reorder_level}</TableCell>
                  <TableCell align="right">{it.sale_price != null ? fmtMoney(it.sale_price) : "—"}</TableCell>
                  <TableCell align="right">{it.current_stock}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openItem({ id: it.id, name: it.name, code: it.code, category_id: it.category_id || "", unit_id: it.unit_id || "", reorder_level: String(it.reorder_level), sale_price: it.sale_price != null ? String(it.sale_price) : "" })}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {(tab === 1 || tab === 2) && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, maxWidth: 520 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <TextField size="small" label={tab === 1 ? "New category" : "New unit"} value={masterName} onChange={(e) => setMasterName(e.target.value)} fullWidth />
            <Button variant="contained" onClick={() => (tab === 1 ? addCat : addUnit).mutate()} disabled={!masterName.trim()}>Add</Button>
          </Stack>
          <Stack spacing={1}>
            {((tab === 1 ? cats.data : units.data) ?? []).map((m) => (
              <Stack key={m.id} direction="row" sx={{ justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", py: 0.5 }}>
                <span>{m.name}</span>
                <IconButton size="small" color="error" onClick={() => (tab === 1 ? delCat : delUnit).mutate(m.id)}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      {tab === 3 && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: "flex-start" }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 320 }}>
            <Stack spacing={1.5}>
              <TextField size="small" label="Supplier name" value={supplierForm.name} onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} />
              <TextField size="small" label="Contact person" value={supplierForm.contact_person} onChange={(e) => setSupplierForm((f) => ({ ...f, contact_person: e.target.value }))} />
              <TextField size="small" label="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} />
              <TextField size="small" label="Email" value={supplierForm.email} onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} />
              <Button variant="contained" onClick={() => addSupplier.mutate()} disabled={!supplierForm.name.trim()}>Add Supplier</Button>
            </Stack>
          </Paper>
          <TableContainer component={Paper} variant="outlined" sx={{ flex: 1 }}>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}><TableRow><TableCell>Name</TableCell><TableCell>Contact</TableCell><TableCell>Phone</TableCell><TableCell>Email</TableCell></TableRow></TableHead>
              <TableBody>
                {(suppliers.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>No suppliers.</TableCell></TableRow>
                ) : suppliers.data!.map((s) => (
                  <TableRow key={s.id} hover><TableCell>{s.name}</TableCell><TableCell>{s.contact_person || "—"}</TableCell><TableCell>{s.phone || "—"}</TableCell><TableCell>{s.email || "—"}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

      <Dialog open={itemDlg} onClose={() => setItemDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>{itemForm.id ? "Edit Item" : "New Item"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Name" fullWidth value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
              <TextField size="small" label="Code" value={itemForm.code} onChange={(e) => setItemForm((f) => ({ ...f, code: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="Category" fullWidth value={itemForm.category_id} onChange={(e) => setItemForm((f) => ({ ...f, category_id: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {(cats.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Unit" fullWidth value={itemForm.unit_id} onChange={(e) => setItemForm((f) => ({ ...f, unit_id: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {(units.data ?? []).map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="number" label="Reorder level" fullWidth value={itemForm.reorder_level} onChange={(e) => setItemForm((f) => ({ ...f, reorder_level: e.target.value }))} />
              <TextField size="small" type="number" label="Sale price" fullWidth value={itemForm.sale_price} onChange={(e) => setItemForm((f) => ({ ...f, sale_price: e.target.value }))} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveItem.mutate()} disabled={!itemForm.name.trim() || saveItem.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </InventoryShell>
  );
}
