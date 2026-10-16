import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  seedDefaultAccounts,
  updateAccount,
  type Account,
  type AccountType,
} from "../../../api/accounting";
import { ACCOUNT_TYPE_COLORS, apiErrorMessage, FilterBar, fmtMoney, PageHeader } from "./common";

const TYPES: AccountType[] = ["asset", "liability", "equity", "income", "expense"];

interface FormState {
  code: string;
  name: string;
  account_type: AccountType;
  parent_id: string;
  subtype: "" | "cash" | "bank";
  description: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  code: "",
  name: "",
  account_type: "expense",
  parent_id: "",
  subtype: "",
  description: "",
  is_active: true,
};

/** Orders accounts depth-first under their parents so the table reads as a tree. */
function toTree(accounts: Account[]): { account: Account; depth: number }[] {
  const byParent = new Map<string | null, Account[]>();
  const ids = new Set(accounts.map((a) => a.id));
  for (const a of accounts) {
    const key = a.parent_id && ids.has(a.parent_id) ? a.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), a]);
  }
  const out: { account: Account; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const a of (byParent.get(parent) ?? []).sort((x, y) => x.code.localeCompare(y.code))) {
      out.push({ account: a, depth });
      walk(a.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function ChartOfAccountsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<"" | AccountType>("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const accountsQuery = useQuery({ queryKey: ["acc-accounts"], queryFn: () => listAccounts() });
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const rows = useMemo(() => {
    const tree = toTree(accounts);
    const q = search.trim().toLowerCase();
    return tree.filter(
      ({ account }) =>
        (!typeFilter || account.account_type === typeFilter) &&
        (!q || account.name.toLowerCase().includes(q) || account.code.includes(q)),
    );
  }, [accounts, typeFilter, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["acc-accounts"] });

  const seed = useMutation({
    mutationFn: seedDefaultAccounts,
    onSuccess: (r) => {
      setNotice(r.created ? `Added ${r.created} default accounts.` : "Default chart of accounts is already in place.");
      invalidate();
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code,
        name: form.name,
        parent_id: form.parent_id || null,
        subtype: form.subtype || null,
        description: form.description || null,
        is_active: form.is_active,
      };
      return editing
        ? updateAccount(editing.id, payload)
        : createAccount({ ...payload, account_type: form.account_type });
    },
    onSuccess: () => {
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not save account.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: invalidate,
    onError: (e) => setNotice(apiErrorMessage(e, "Could not delete account.")),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({
      code: a.code,
      name: a.name,
      account_type: a.account_type,
      parent_id: a.parent_id ?? "",
      subtype: a.subtype ?? "",
      description: a.description ?? "",
      is_active: a.is_active,
    });
    setError(null);
    setDialogOpen(true);
  }

  const parentOptions = accounts.filter((a) => a.account_type === form.account_type && a.id !== editing?.id);

  return (
    <AppShell title="Accounts" navItems={adminNavItems}>
      <PageHeader
        title="Chart of Accounts"
        actions={
          <>
            <Button variant="outlined" startIcon={<AutoFixHighIcon />} onClick={() => seed.mutate()} disabled={seed.isPending}>
              Load default chart
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add account
            </Button>
          </>
        }
      />

      {notice && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <FilterBar>
        <TextField size="small" placeholder="Search code or name" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 260 }} />
        <TextField select size="small" label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | AccountType)} sx={{ width: 180 }}>
          <MenuItem value="">All types</MenuItem>
          {TYPES.map((t) => (
            <MenuItem key={t} value={t} sx={{ textTransform: "capitalize" }}>
              {t}
            </MenuItem>
          ))}
        </TextField>
      </FilterBar>

      {accountsQuery.isLoading && <Box>Loading…</Box>}
      {!accountsQuery.isLoading && accounts.length === 0 && (
        <Alert severity="info">No accounts yet — click "Load default chart" to start with a standard school chart of accounts.</Alert>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Cash/Bank</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ account: a, depth }) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontFamily: "monospace" }}>{a.code}</TableCell>
                  <TableCell sx={{ pl: 2 + depth * 3, fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 400 }}>{a.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={a.account_type} color={ACCOUNT_TYPE_COLORS[a.account_type]} variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{a.subtype ?? ""}</TableCell>
                  <TableCell align="right">{fmtMoney(a.balance)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={a.is_active ? "active" : "inactive"} color={a.is_active ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(a)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        if (window.confirm(`Delete account ${a.code} — ${a.name}?`)) remove.mutate(a.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit account" : "Add account"}</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <TextField label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required sx={{ width: 140 }} />
                <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
              </Stack>
              <TextField
                select
                label="Account type"
                value={form.account_type}
                disabled={!!editing}
                onChange={(e) => setForm({ ...form, account_type: e.target.value as AccountType, parent_id: "" })}
              >
                {TYPES.map((t) => (
                  <MenuItem key={t} value={t} sx={{ textTransform: "capitalize" }}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Parent account" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
                <MenuItem value="">— None (top level) —</MenuItem>
                {parentOptions.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </MenuItem>
                ))}
              </TextField>
              {form.account_type === "asset" && (
                <TextField
                  select
                  label="Cash / bank account?"
                  value={form.subtype}
                  onChange={(e) => setForm({ ...form, subtype: e.target.value as FormState["subtype"] })}
                  helperText="Cash and bank accounts appear in quick entries and the cash book."
                >
                  <MenuItem value="">No</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank</MenuItem>
                </TextField>
              )}
              <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline minRows={2} />
              <FormControlLabel
                control={<Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
                label="Active"
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
