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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createAdvance, deleteAdvance, listAdvances, money, type Employee } from "../../../api/payroll";
import { EmployeeSelect, PageHeader } from "./payrollShared";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AdvancesPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"active" | "repaid" | "all">("all");
  const [open, setOpen] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [amount, setAmount] = useState("");
  const [installment, setInstallment] = useState("");
  const [issuedOn, setIssuedOn] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const advances = useQuery({
    queryKey: ["payroll-advances", statusFilter],
    queryFn: () => listAdvances(statusFilter === "all" ? undefined : { status: statusFilter }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["payroll-advances"] });

  const add = useMutation({
    mutationFn: () => createAdvance({
      employee_type: employee!.employee_type, employee_id: employee!.employee_id,
      amount: Number(amount), monthly_installment: Number(installment), issued_on: issuedOn, reason: reason || undefined,
    }),
    onSuccess: () => { setOpen(false); setEmployee(null); setAmount(""); setInstallment(""); setReason(""); invalidate(); },
    onError: (e: unknown) => setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not create advance."),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteAdvance(id), onSuccess: invalidate });

  return (
    <AppShell title="Payroll — Staff Loans" navItems={adminNavItems}>
      <PageHeader title="Staff Loans & Advances" action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setOpen(true); }}>New Advance</Button>} />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} sx={{ minWidth: 160 }}>
          <MenuItem value="all">All</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="repaid">Repaid</MenuItem>
        </TextField>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Employee</TableCell><TableCell>Issued</TableCell><TableCell align="right">Amount</TableCell>
            <TableCell align="right">Monthly</TableCell><TableCell align="right">Repaid</TableCell><TableCell align="right">Balance</TableCell>
            <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {advances.isLoading ? (
              <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>
            ) : (advances.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} sx={{ color: "text.secondary" }}>No advances. Installments are recovered automatically in each pay run.</TableCell></TableRow>
            ) : advances.data!.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>{a.employee_name}{a.reason && <div style={{ color: "#667085", fontSize: 12 }}>{a.reason}</div>}</TableCell>
                <TableCell>{a.issued_on}</TableCell>
                <TableCell align="right">{money(a.amount)}</TableCell>
                <TableCell align="right">{money(a.monthly_installment)}</TableCell>
                <TableCell align="right">{money(a.amount_repaid)}</TableCell>
                <TableCell align="right">{money(a.balance)}</TableCell>
                <TableCell><Chip size="small" color={a.status === "repaid" ? "success" : "warning"} label={a.status} /></TableCell>
                <TableCell align="right">{a.status === "active" && <IconButton size="small" color="error" onClick={() => remove.mutate(a.id)}><DeleteIcon fontSize="small" /></IconButton>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Advance / Loan</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <EmployeeSelect value={employee} onChange={setEmployee} required />
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="number" label="Amount" fullWidth value={amount} onChange={(e) => setAmount(e.target.value)} />
              <TextField size="small" type="number" label="Monthly installment" fullWidth value={installment} onChange={(e) => setInstallment(e.target.value)} />
            </Stack>
            <TextField size="small" type="date" label="Issued on" slotProps={{ inputLabel: { shrink: true } }} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
            <TextField size="small" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Typography variant="caption" color="text.secondary">The monthly installment is deducted automatically in each pay run until repaid.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!employee || !amount || !installment || add.isPending}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
