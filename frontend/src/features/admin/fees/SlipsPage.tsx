import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses } from "../../../api/classes";
import {
  listCollectionInvoices,
  getVoucherPdfUrl,
  getBulkVoucherPdfUrl,
} from "../../../api/feeCollection";

const MONTHS = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

export function SlipsPage() {
  const today = new Date();
  const [classGradeId, setClassGradeId] = useState("");
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [includePaid, setIncludePaid] = useState(false);

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });

  const invoicesQuery = useQuery({
    queryKey: ["slips-invoices", classGradeId, month, year, includePaid],
    queryFn: () =>
      listCollectionInvoices({
        class_grade_id: classGradeId || undefined,
        period_month: month || undefined,
        period_year: year || undefined,
        open_only: !includePaid,
      }),
    enabled: !!classGradeId,
  });

  const invoices = invoicesQuery.data ?? [];

  const bulkPdfUrl = getBulkVoucherPdfUrl({
    class_grade_id: classGradeId || undefined,
    period_month: month || undefined,
    period_year: year || undefined,
    include_paid: includePaid,
  });

  const selectedClass = (classesQuery.data ?? []).find((c) => c.id === classGradeId);

  return (
    <AppShell title="Slips" navItems={adminNavItems}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Fee Slips / Vouchers</Typography>
        {invoices.length > 0 && (
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            href={bulkPdfUrl}
            target="_blank"
          >
            Print All Vouchers ({invoices.length})
          </Button>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Select a class and month to view and print fee voucher slips. Each voucher shows all
        pending dues including arrears from previous months.
      </Typography>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }} required>
            <InputLabel>Class *</InputLabel>
            <Select value={classGradeId} label="Class *" onChange={(e) => setClassGradeId(e.target.value)}>
              {(classesQuery.data ?? []).map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Month</InputLabel>
            <Select value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.slice(1).map((m, i) => (
                <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Include Paid</InputLabel>
            <Select value={includePaid ? "yes" : "no"} label="Include Paid" onChange={(e) => setIncludePaid(e.target.value === "yes")}>
              <MenuItem value="no">Unpaid Only</MenuItem>
              <MenuItem value="yes">All (including paid)</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {!classGradeId && (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary">Select a class to view fee slips.</Typography>
        </Box>
      )}

      {classGradeId && invoicesQuery.isLoading && (
        <Typography color="text.secondary" textAlign="center" py={4}>Loading…</Typography>
      )}

      {classGradeId && !invoicesQuery.isLoading && invoices.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
          <Typography color="text.secondary">
            No fee challans found for {selectedClass?.name} — {MONTHS[month]} {year}.
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Use "Create Challan" to generate monthly fee challans first.
          </Typography>
        </Paper>
      )}

      {invoices.length > 0 && (
        <>
          <Stack direction="row" spacing={2} mb={2} alignItems="center">
            <Typography variant="subtitle1" fontWeight={600}>
              {selectedClass?.name} — {MONTHS[month]} {year}
            </Typography>
            <Chip label={`${invoices.length} students`} size="small" />
            <Chip label={`Total: ${fmt(invoices.reduce((s, i) => s + i.net_amount, 0))}`} color="primary" size="small" variant="outlined" />
            <Chip label={`Collected: ${fmt(invoices.reduce((s, i) => s + i.amount_paid, 0))}`} color="success" size="small" variant="outlined" />
            <Chip label={`Pending: ${fmt(invoices.reduce((s, i) => s + i.balance, 0))}`} color="error" size="small" variant="outlined" />
          </Stack>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Student</TableCell>
                  <TableCell>Adm #</TableCell>
                  <TableCell>Invoice #</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Voucher</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv, idx) => (
                  <TableRow key={inv.id} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{inv.student_name}</TableCell>
                    <TableCell>{inv.admission_number ?? "—"}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{inv.invoice_number}</TableCell>
                    <TableCell align="right">{fmt(inv.net_amount)}</TableCell>
                    <TableCell align="right">{fmt(inv.amount_paid)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: inv.balance > 0 ? 700 : 400, color: inv.balance > 0 ? "error.main" : "success.main" }}>
                      {fmt(inv.balance)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={inv.status}
                        size="small"
                        color={inv.status === "paid" ? "success" : inv.status === "overdue" ? "error" : "warning"}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<PictureAsPdfIcon />}
                        href={getVoucherPdfUrl(inv.id)}
                        target="_blank"
                        variant="outlined"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </AppShell>
  );
}
