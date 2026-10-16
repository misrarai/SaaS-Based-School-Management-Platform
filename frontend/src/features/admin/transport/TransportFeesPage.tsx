import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
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
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { apiErrorMessage } from "../../../lib/apiError";
import { generateTransportFees, listTransportFees, type FeeGenerateResult, type TransportFeeRecord } from "../../../api/transport";
import { generateHostelFees, listHostelFees } from "../../../api/hostel";
import { adminNavWithTransportHostel } from "../../transportHostelNav";
import { MONTHS, PageHeader, fmtMoney } from "../../transportHostelUi";

/** Monthly fee generation + issued-records list. Shared by Transport and Hostel (same shape). */
export function MonthlyFeesPanel({ kind }: { kind: "transport" | "hostel" }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dueDate, setDueDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-10`,
  );
  const [result, setResult] = useState<FeeGenerateResult<TransportFeeRecord> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const records = useQuery({
    queryKey: [kind, "fees", month, year],
    queryFn: () => (kind === "transport" ? listTransportFees({ month, year }) : listHostelFees({ month, year })),
  });

  const generate = useMutation({
    mutationFn: () => {
      const payload = { period_month: month, period_year: year, due_date: dueDate };
      return kind === "transport" ? generateTransportFees(payload) : generateHostelFees(payload);
    },
    onSuccess: (res) => {
      setResult(res);
      setError(null);
      queryClient.invalidateQueries({ queryKey: [kind, "fees"] });
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not generate invoices.")),
  });

  const total = records.data?.reduce((sum, r) => sum + r.amount, 0) ?? 0;

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Generate monthly {kind} invoices
        </Typography>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2, alignItems: "center" }}>
          <TextField select size="small" label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 150 }}>
            {MONTHS.map((m, i) => (
              <MenuItem key={m} value={i + 1}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ width: 110 }} />
          <TextField size="small" label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button variant="contained" onClick={() => generate.mutate()} disabled={generate.isPending}>
            Generate invoices
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Creates one "Other" invoice per allocated student ({kind === "transport" ? "stop fare" : "room fee"}). Students
          already billed for the month are skipped, so it is safe to run again.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {result && (
          <Alert severity={result.created_count ? "success" : "info"} sx={{ mt: 2 }}>
            {result.created_count} invoice(s) created, {result.skipped_count} skipped.
            {result.skipped.length > 0 && (
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {result.skipped.slice(0, 10).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {records.data?.length ?? 0} invoice(s) issued for {MONTHS[month - 1]} {year} · total {fmtMoney(total)}
      </Typography>
      {!!records.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.data.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.invoice_number ?? "—"}</TableCell>
                  <TableCell>{r.student_name ?? "—"}</TableCell>
                  <TableCell>
                    {MONTHS[r.period_month - 1]} {r.period_year}
                  </TableCell>
                  <TableCell>{fmtMoney(r.amount)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={r.invoice_status ?? "—"}
                      color={r.invoice_status === "paid" ? "success" : r.invoice_status === "overdue" ? "error" : "warning"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}

export function TransportFeesPage() {
  return (
    <AppShell title="Transport" navItems={adminNavWithTransportHostel()}>
      <PageHeader title="Transport Fees" />
      <MonthlyFeesPanel kind="transport" />
    </AppShell>
  );
}
