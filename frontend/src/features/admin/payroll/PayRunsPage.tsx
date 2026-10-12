import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
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
import DeleteIcon from "@mui/icons-material/Delete";
import PdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import TableIcon from "@mui/icons-material/GridOnOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  addPayslipAdjustment, approvePayrollRun, deletePayrollRun, downloadFile, generatePayrollRun,
  getPayrollRun, listPayrollRuns, markPayrollRunPaid, money, openPdf, payrollSheetPdfUrl,
  payrollSheetXlsxUrl, payslipPdfUrl, periodLabel, removePayslipAdjustment,
  type AdjustmentKind, type Payslip,
} from "../../../api/payroll";
import { PayrollStatusChip } from "./payrollShared";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const now = new Date();

function PayslipDialog({ payslip, onClose }: { payslip: Payslip; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<AdjustmentKind>("bonus");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["payroll-run", payslip.payroll_run_id] });
  const add = useMutation({ mutationFn: () => addPayslipAdjustment(payslip.id, { kind, amount: Number(amount), note: note || undefined }), onSuccess: () => { setAmount(""); setNote(""); refresh(); } });
  const del = useMutation({ mutationFn: (id: string) => removePayslipAdjustment(payslip.id, id), onSuccess: refresh });
  const editable = payslip.status !== "paid";

  const row = (label: string, value: string, bold = false) => (
    <Stack direction="row" sx={{ justifyContent: "space-between", py: 0.3, fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span><span>{value}</span>
    </Stack>
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{payslip.employee_name} — {periodLabel(payslip.period_month, payslip.period_year)}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {row("Basic salary", money(payslip.basic_salary))}
          {payslip.allowances.map((a) => row(`+ ${a.name}`, money(a.amount)))}
          {row("Gross", money(payslip.gross_salary), true)}
          <Divider />
          {payslip.absence_deduction > 0 && row(`− Absence (${payslip.absent_days}d)`, money(payslip.absence_deduction))}
          {payslip.structure_deductions > 0 && row("− Deductions", money(payslip.structure_deductions))}
          {payslip.advance_deduction > 0 && row("− Advance recovery", money(payslip.advance_deduction))}
          {payslip.bonus > 0 && row("+ Bonus", money(payslip.bonus))}
          {payslip.adjustment_deduction > 0 && row("− Fines/adjustments", money(payslip.adjustment_deduction))}
          {row("Net pay", money(payslip.net_pay), true)}
        </Stack>

        {editable && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Adjustments</Typography>
            {payslip.adjustments.map((a) => (
              <Stack key={a.id} direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                <span>{a.kind} · {money(a.amount)}{a.note ? ` · ${a.note}` : ""}</span>
                <IconButton size="small" color="error" onClick={() => del.mutate(a.id)}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField select size="small" label="Kind" value={kind} onChange={(e) => setKind(e.target.value as AdjustmentKind)} sx={{ minWidth: 110 }}>
                <MenuItem value="bonus">Bonus</MenuItem><MenuItem value="advance">Advance</MenuItem><MenuItem value="fine">Fine</MenuItem>
              </TextField>
              <TextField size="small" type="number" label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} sx={{ width: 110 }} />
              <TextField size="small" label="Note" value={note} onChange={(e) => setNote(e.target.value)} fullWidth />
              <Button variant="outlined" onClick={() => add.mutate()} disabled={!amount || add.isPending}>Add</Button>
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button startIcon={<PdfIcon />} onClick={() => openPdf(payslipPdfUrl(payslip.id), "payslip.pdf")}>Payslip PDF</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export function PayRunsPage() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runs = useQuery({ queryKey: ["payroll-runs"], queryFn: listPayrollRuns });
  const detail = useQuery({ queryKey: ["payroll-run", openId], queryFn: () => getPayrollRun(openId!), enabled: !!openId });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["payroll-runs"] }); if (openId) qc.invalidateQueries({ queryKey: ["payroll-run", openId] }); };

  const gen = useMutation({
    mutationFn: () => generatePayrollRun({ period_month: month, period_year: year }),
    onSuccess: (r) => { setGenOpen(false); invalidate(); setOpenId(r.id); },
    onError: (e: unknown) => setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not generate the run."),
  });
  const approve = useMutation({ mutationFn: (id: string) => approvePayrollRun(id), onSuccess: invalidate });
  const pay = useMutation({ mutationFn: (id: string) => markPayrollRunPaid(id), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => deletePayrollRun(id), onSuccess: () => { setOpenId(null); invalidate(); } });

  if (openId && detail.data) {
    const d = detail.data;
    return (
      <AppShell title="Payroll — Pay Run" navItems={adminNavItems}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button onClick={() => setOpenId(null)}>← Runs</Button>
            <Typography variant="h5">{periodLabel(d.period_month, d.period_year)}</Typography>
            <PayrollStatusChip status={d.status} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<PdfIcon />} onClick={() => openPdf(payrollSheetPdfUrl(d.id), "payroll-sheet.pdf")}>Sheet PDF</Button>
            <Button startIcon={<TableIcon />} onClick={() => downloadFile(payrollSheetXlsxUrl(d.id), "payroll-sheet.xlsx")}>Excel</Button>
            {d.status === "draft" && <Button variant="contained" color="success" onClick={() => approve.mutate(d.id)}>Approve</Button>}
            {d.status === "approved" && <Button variant="contained" onClick={() => pay.mutate(d.id)}>Mark Paid</Button>}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}><Typography variant="caption">Employees</Typography><Typography variant="h6">{d.employee_count}</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}><Typography variant="caption">Gross</Typography><Typography variant="h6">{money(d.total_gross)}</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}><Typography variant="caption">Deductions</Typography><Typography variant="h6">{money(d.total_deductions)}</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}><Typography variant="caption">Net payable</Typography><Typography variant="h6">{money(d.total_net)}</Typography></Paper>
        </Stack>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={darkTableHeadSx}><TableRow>
              <TableCell>Employee</TableCell><TableCell>Designation</TableCell><TableCell align="right">Gross</TableCell>
              <TableCell align="right">Deductions</TableCell><TableCell align="right">Net pay</TableCell><TableCell align="right">Payslip</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {d.payslips.map((ps) => (
                <TableRow key={ps.id} hover>
                  <TableCell>{ps.employee_name}</TableCell>
                  <TableCell>{ps.designation || "—"}</TableCell>
                  <TableCell align="right">{money(ps.gross_salary)}</TableCell>
                  <TableCell align="right">{money(ps.total_deductions)}</TableCell>
                  <TableCell align="right">{money(ps.net_pay)}</TableCell>
                  <TableCell align="right"><Button size="small" onClick={() => setPayslip(ps)}>View</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {payslip && <PayslipDialog payslip={payslip} onClose={() => setPayslip(null)} />}
      </AppShell>
    );
  }

  return (
    <AppShell title="Payroll — Pay Salary" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Pay Salary</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setGenOpen(true); }}>Generate Pay Run</Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Period</TableCell><TableCell align="right">Employees</TableCell><TableCell align="right">Net payable</TableCell>
            <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {runs.isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
            ) : (runs.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No pay runs yet. Generate one to pay salaries.</TableCell></TableRow>
            ) : runs.data!.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{periodLabel(r.period_month, r.period_year)}</TableCell>
                <TableCell align="right">{r.employee_count}</TableCell>
                <TableCell align="right">{money(r.total_net)}</TableCell>
                <TableCell><PayrollStatusChip status={r.status} /></TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setOpenId(r.id)}>Open</Button>
                  {r.status === "draft" && <IconButton size="small" color="error" onClick={() => remove.mutate(r.id)}><DeleteIcon fontSize="small" /></IconButton>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={genOpen} onClose={() => setGenOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Generate Pay Run</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="Month" fullWidth value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label="Year" fullWidth value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </Stack>
            <Typography variant="caption" color="text.secondary">Generates payslips for every active employee with a salary structure.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => gen.mutate()} disabled={gen.isPending}>Generate</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
