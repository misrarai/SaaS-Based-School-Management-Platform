import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  apiErrorMessage,
  createSalaryStructure,
  deleteSalaryStructure,
  listSalaryStructures,
  money,
  type Employee,
  type SalaryLine,
} from "../../../api/payroll";
import { adminNavWithPayroll } from "../../payrollNav";
import { EmployeeSelect, EmployeeTypeChip, PageHeader } from "./payrollShared";

const ALLOWANCE_TYPES: Record<string, string> = {
  house_rent: "House Rent",
  medical: "Medical",
  conveyance: "Conveyance",
  custom: "Custom",
};
const DEDUCTION_TYPES: Record<string, string> = {
  provident_fund: "Provident Fund",
  tax: "Income Tax",
  custom: "Custom",
};

interface LineDraft {
  type: string;
  name: string;
  amount: string;
}

function LinesEditor({
  title,
  types,
  lines,
  onChange,
}: {
  title: string;
  types: Record<string, string>;
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<LineDraft>) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...lines, { type: "custom", name: "", amount: "" }])}>
          Add
        </Button>
      </Stack>
      <Stack spacing={1}>
        {lines.length === 0 && <Typography variant="body2" color="text.secondary">None</Typography>}
        {lines.map((l, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <TextField
              select
              size="small"
              label="Type"
              value={l.type}
              onChange={(e) => {
                const type = e.target.value;
                update(i, { type, name: type !== "custom" ? types[type] : l.name });
              }}
              sx={{ width: 160 }}
            >
              {Object.entries(types).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Name" value={l.name} onChange={(e) => update(i, { name: e.target.value })} required sx={{ flex: 1 }} />
            <TextField
              size="small"
              label="Amount"
              type="number"
              value={l.amount}
              onChange={(e) => update(i, { amount: e.target.value })}
              required
              sx={{ width: 130 }}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />
            <IconButton size="small" aria-label="Remove" onClick={() => onChange(lines.filter((_, idx) => idx !== i))}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

const toLines = (drafts: LineDraft[]): SalaryLine[] =>
  drafts.map((d) => ({ type: d.type, name: d.name.trim(), amount: Number(d.amount) || 0 }));

export function SalaryStructuresPage() {
  const queryClient = useQueryClient();
  const [filterEmployee, setFilterEmployee] = useState<Employee | null>(null);
  const structuresQuery = useQuery({
    queryKey: ["payroll", "salary-structures", filterEmployee?.employee_type, filterEmployee?.employee_id],
    queryFn: () =>
      listSalaryStructures(
        filterEmployee ? { employee_type: filterEmployee.employee_type, employee_id: filterEmployee.employee_id } : undefined,
      ),
  });

  const [open, setOpen] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [basic, setBasic] = useState("");
  const [allowances, setAllowances] = useState<LineDraft[]>([]);
  const [deductions, setDeductions] = useState<LineDraft[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setEmployee(filterEmployee);
    setBasic("");
    setAllowances([
      { type: "house_rent", name: "House Rent", amount: "" },
      { type: "medical", name: "Medical", amount: "" },
      { type: "conveyance", name: "Conveyance", amount: "" },
    ]);
    setDeductions([]);
    setNotes("");
    setError(null);
    setOpen(true);
  }

  const total = (lines: LineDraft[]) => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const gross = (Number(basic) || 0) + total(allowances);

  const create = useMutation({
    mutationFn: () =>
      createSalaryStructure({
        employee_type: employee!.employee_type,
        employee_id: employee!.employee_id,
        basic_salary: Number(basic),
        allowances: toLines(allowances.filter((a) => a.amount !== "")),
        deductions: toLines(deductions.filter((d) => d.amount !== "")),
        effective_from: effectiveFrom,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not save salary structure.")),
  });

  const remove = useMutation({
    mutationFn: deleteSalaryStructure,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  });

  return (
    <AppShell title="Payroll & Leaves" navItems={adminNavWithPayroll()}>
      <PageHeader
        title="Salary Structures"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>New salary structure</Button>}
      />
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Box sx={{ maxWidth: 420 }}>
          <EmployeeSelect value={filterEmployee} onChange={setFilterEmployee} label="Filter by employee" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          The structure used in a payroll month is the latest one effective on or before that month's last day.
          Create a new structure to revise a salary — older versions are kept for history.
        </Typography>
      </Paper>

      {structuresQuery.data?.length === 0 && <Alert severity="info">No salary structures yet.</Alert>}
      {!!structuresQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Effective from</TableCell>
                <TableCell align="right">Basic</TableCell>
                <TableCell>Allowances</TableCell>
                <TableCell>Deductions</TableCell>
                <TableCell align="right">Gross</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {structuresQuery.data.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.employee_name}</TableCell>
                  <TableCell><EmployeeTypeChip type={s.employee_type} /></TableCell>
                  <TableCell>{s.effective_from}</TableCell>
                  <TableCell align="right">{money(s.basic_salary)}</TableCell>
                  <TableCell>
                    {s.allowances.length ? s.allowances.map((a) => `${a.name}: ${money(a.amount)}`).join(", ") : "—"}
                  </TableCell>
                  <TableCell>
                    {s.deductions.length ? s.deductions.map((d) => `${d.name}: ${money(d.amount)}`).join(", ") : "—"}
                  </TableCell>
                  <TableCell align="right"><strong>{money(s.gross_salary)}</strong></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" aria-label="Delete" onClick={() => remove.mutate(s.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>New salary structure</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!employee) {
              setError("Select an employee.");
              return;
            }
            create.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <EmployeeSelect value={employee} onChange={setEmployee} required />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Basic salary"
                  type="number"
                  value={basic}
                  onChange={(e) => setBasic(e.target.value)}
                  required
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                />
                <TextField
                  label="Effective from"
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
              <Divider />
              <LinesEditor title="Allowances" types={ALLOWANCE_TYPES} lines={allowances} onChange={setAllowances} />
              <Divider />
              <LinesEditor title="Deductions" types={DEDUCTION_TYPES} lines={deductions} onChange={setDeductions} />
              <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
              <Alert severity="info" icon={false}>
                Gross: <strong>{money(gross)}</strong> · Fixed deductions: <strong>{money(total(deductions))}</strong> · Net before
                attendance: <strong>{money(gross - total(deductions))}</strong>
              </Alert>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
