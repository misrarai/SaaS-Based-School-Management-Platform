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
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import FilterListIcon from "@mui/icons-material/FilterList";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses } from "../../../api/classes";
import {
  listCollectionInvoices,
  getVoucherPdfUrl,
  getBulkVoucherPdfUrl,
  type InvoiceStatus,
} from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

const MONTHS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_COLOR: Record<InvoiceStatus, "default" | "warning" | "success" | "error"> = {
  pending: "warning",
  partial: "warning",
  paid: "success",
  overdue: "error",
  cancelled: "default",
};

export function ViewChallanPage() {
  const today = new Date();
  const [classGradeId, setClassGradeId] = useState("");
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [openOnly, setOpenOnly] = useState(false);
  const [search, setSearch] = useState("");

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });

  const invoicesQuery = useQuery({
    queryKey: ["fee-collection-invoices", classGradeId, month, year, openOnly],
    queryFn: () =>
      listCollectionInvoices({
        class_grade_id: classGradeId || undefined,
        period_month: month || undefined,
        period_year: year || undefined,
        open_only: openOnly || undefined,
      }),
  });

  const invoices = (invoicesQuery.data ?? []).filter((inv) =>
    !search ||
    inv.student_name.toLowerCase().includes(search.toLowerCase()) ||
    (inv.admission_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase())
  );

  const totalDues = invoices.reduce((s, i) => s + i.net_amount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.amount_paid, 0);
  const totalBalance = invoices.reduce((s, i) => s + i.balance, 0);

  const bulkPdfUrl = getBulkVoucherPdfUrl({
    class_grade_id: classGradeId || undefined,
    period_month: month || undefined,
    period_year: year || undefined,
  });

  return (
    <AppShell title="View Challan" navItems={adminNavItems}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">View Challan</Typography>
        <Button
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          href={bulkPdfUrl}
          target="_blank"
          disabled={invoices.length === 0}
        >
          Print All Vouchers
        </Button>
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <FilterListIcon color="action" />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Class</InputLabel>
            <Select value={classGradeId} label="Class" onChange={(e) => setClassGradeId(e.target.value)}>
              <MenuItem value="">All Classes</MenuItem>
              {(classesQuery.data ?? []).map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Month</InputLabel>
            <Select value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
              <MenuItem value={0}>All</MenuItem>
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
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select value={openOnly ? "open" : "all"} label="Status" onChange={(e) => setOpenOnly(e.target.value === "open")}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="open">Open (unpaid)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Search student / invoice #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
          />
        </Stack>
      </Paper>

      {/* Summary strip */}
      {invoices.length > 0 && (
        <Stack direction="row" spacing={2} mb={2}>
          <Chip label={`${invoices.length} challans`} />
          <Chip label={`Billed: ${fmt(totalDues)}`} color="primary" variant="outlined" />
          <Chip label={`Collected: ${fmt(totalPaid)}`} color="success" variant="outlined" />
          <Chip label={`Pending: ${fmt(totalBalance)}`} color={totalBalance > 0 ? "error" : "default"} variant="outlined" />
        </Stack>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Student</TableCell>
              <TableCell>Adm #</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Month</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Voucher</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoicesQuery.isLoading && (
              <TableRow><TableCell colSpan={11} align="center"><Typography py={2}>Loading…</Typography></TableCell></TableRow>
            )}
            {!invoicesQuery.isLoading && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  <Box py={4}>
                    <Typography color="text.secondary">No challans found for the selected filters.</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Use Create Challan to generate monthly fee challans.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {invoices.map((inv) => (
              <TableRow key={inv.id} hover>
                <TableCell sx={{ fontFamily: "monospace" }}>{inv.invoice_number}</TableCell>
                <TableCell>{inv.student_name}</TableCell>
                <TableCell>{inv.admission_number ?? "—"}</TableCell>
                <TableCell>{inv.class_grade_name}</TableCell>
                <TableCell>
                  {inv.period_month ? `${MONTHS[inv.period_month]} ${inv.period_year}` : "—"}
                </TableCell>
                <TableCell>{inv.due_date}</TableCell>
                <TableCell align="right">{fmt(inv.net_amount)}</TableCell>
                <TableCell align="right">{fmt(inv.amount_paid)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: inv.balance > 0 ? 700 : 400, color: inv.balance > 0 ? "error.main" : "text.primary" }}>
                  {fmt(inv.balance)}
                </TableCell>
                <TableCell>
                  <Chip label={inv.status} size="small" color={STATUS_COLOR[inv.status]} />
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    href={getVoucherPdfUrl(inv.id)}
                    target="_blank"
                  >
                    PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </AppShell>
  );
}
