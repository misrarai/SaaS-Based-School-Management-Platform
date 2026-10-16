import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses } from "../../../api/classes";
import {
  getDailyCollectionReport,
  getClassCollectionSummary,
  type PaymentMethod,
} from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const MONTHS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function FeeCollectionReportsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [tab, setTab] = useState(0);

  // Daily collection state
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");

  // Class summary state
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryClassId, setSummaryClassId] = useState("");

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });

  const dailyQuery = useQuery({
    queryKey: ["daily-collection", dateFrom, dateTo, paymentMethod],
    queryFn: () => getDailyCollectionReport({
      date_from: dateFrom,
      date_to: dateTo,
      payment_method: paymentMethod || undefined,
    }),
    enabled: tab === 0,
  });

  const classSummaryQuery = useQuery({
    queryKey: ["class-summary", summaryMonth, summaryYear],
    queryFn: () => getClassCollectionSummary({ period_month: summaryMonth, period_year: summaryYear }),
    enabled: tab === 1,
  });

  const daily = dailyQuery.data;
  const summary = classSummaryQuery.data;

  const filteredSummaryRows = (summary?.rows ?? []).filter(
    (r) => !summaryClassId || r.class_grade_id === summaryClassId
  );

  return (
    <AppShell title="Fee Reports" navItems={adminNavItems}>
      <Stack direction="row" spacing={1} alignItems="center" mb={3}>
        <AssessmentIcon color="primary" />
        <Typography variant="h4">Fee Reports</Typography>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Daily Collection Report" />
        <Tab label="Fee Register (Class Summary)" />
      </Tabs>

      {/* ── Daily Collection ── */}
      {tab === 0 && (
        <Stack spacing={3}>
          {/* Filters */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
              <TextField
                label="From Date"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
              <TextField
                label="To Date"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
                >
                  <MenuItem value="">All Methods</MenuItem>
                  <MenuItem value="CASH">Cash</MenuItem>
                  <MenuItem value="BANK">Bank</MenuItem>
                  <MenuItem value="ONLINE">Online</MenuItem>
                  <MenuItem value="JAZZCASH">JazzCash</MenuItem>
                  <MenuItem value="EASYPAISA">EasyPaisa</MenuItem>
                </Select>
              </FormControl>
              <Button variant="outlined" startIcon={<DownloadIcon />} href={`/api/v1/fee-collection/reports/daily-collection/export?date_from=${dateFrom}&date_to=${dateTo}`} target="_blank">
                Export Excel
              </Button>
            </Stack>
          </Paper>

          {daily && (
            <>
              {/* Summary cards */}
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Card variant="outlined" sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Total Collected</Typography>
                    <Typography variant="h5" fontWeight={700} color="success.main">{fmt(daily.total)}</Typography>
                  </CardContent>
                </Card>
                {Object.entries(daily.by_method).map(([method, amount]) => (
                  <Card key={method} variant="outlined" sx={{ flex: 1, minWidth: 140, borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">{method}</Typography>
                      <Typography variant="h6" fontWeight={600}>{fmt(amount)}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              {/* Day-wise breakdown */}
              {daily.by_day.length > 1 && (
                <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} p={2}>Day-wise Breakdown</Typography>
                  <Table size="small">
                    <TableHead sx={darkTableHeadSx}>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Transactions</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {daily.by_day.map((d) => (
                        <TableRow key={d.day} hover>
                          <TableCell>{d.day}</TableCell>
                          <TableCell align="right">{d.count}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(d.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              {/* Payments table */}
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} p={2}>
                  Payment Details ({daily.payments.length} transactions)
                </Typography>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Receipt #</TableCell>
                      <TableCell>Student</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Invoice #</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Collector</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {daily.payments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography color="text.secondary" py={2}>No payments in this date range.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {daily.payments.map((p) => (
                      <TableRow key={p.payment_id} hover>
                        <TableCell>{p.collected_on}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{p.receipt_number ?? "—"}</TableCell>
                        <TableCell>{p.student_name}</TableCell>
                        <TableCell>{p.class_grade_name ?? "—"}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{p.invoice_number}</TableCell>
                        <TableCell><Chip label={p.payment_method} size="small" /></TableCell>
                        <TableCell>{p.collector_name ?? "—"}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      )}

      {/* ── Class Summary / Fee Register ── */}
      {tab === 1 && (
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Month</InputLabel>
                <Select value={summaryMonth} label="Month" onChange={(e) => setSummaryMonth(Number(e.target.value))}>
                  {MONTHS.slice(1).map((m, i) => (
                    <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Year</InputLabel>
                <Select value={summaryYear} label="Year" onChange={(e) => setSummaryYear(Number(e.target.value))}>
                  {[2024, 2025, 2026, 2027].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Filter Class</InputLabel>
                <Select value={summaryClassId} label="Filter Class" onChange={(e) => setSummaryClassId(e.target.value)}>
                  <MenuItem value="">All Classes</MenuItem>
                  {(classesQuery.data ?? []).map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {summary && (
            <>
              <Stack direction="row" spacing={2}>
                <Card variant="outlined" sx={{ flex: 1, borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Total Billed</Typography>
                    <Typography variant="h5" fontWeight={700} color="primary.main">{fmt(summary.total_billed)}</Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ flex: 1, borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Total Collected</Typography>
                    <Typography variant="h5" fontWeight={700} color="success.main">{fmt(summary.total_collected)}</Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ flex: 1, borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                    <Typography variant="h5" fontWeight={700} color="error.main">{fmt(summary.total_outstanding)}</Typography>
                  </CardContent>
                </Card>
              </Stack>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} p={2}>
                  Fee Register — {MONTHS[summaryMonth]} {summaryYear}
                </Typography>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Class</TableCell>
                      <TableCell align="right">Students</TableCell>
                      <TableCell align="right">Invoices</TableCell>
                      <TableCell align="right">Billed</TableCell>
                      <TableCell align="right">Collected</TableCell>
                      <TableCell align="right">Outstanding</TableCell>
                      <TableCell align="right">Collection %</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSummaryRows.map((r) => (
                      <TableRow key={r.class_grade_id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{r.class_grade_name}</TableCell>
                        <TableCell align="right">{r.students}</TableCell>
                        <TableCell align="right">{r.invoices}</TableCell>
                        <TableCell align="right">{fmt(r.billed)}</TableCell>
                        <TableCell align="right" sx={{ color: "success.main", fontWeight: 600 }}>{fmt(r.collected)}</TableCell>
                        <TableCell align="right" sx={{ color: r.outstanding > 0 ? "error.main" : "text.primary", fontWeight: 600 }}>{fmt(r.outstanding)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={r.billed > 0 ? `${Math.round((r.collected / r.billed) * 100)}%` : "—"}
                            size="small"
                            color={r.billed > 0 && r.collected / r.billed >= 0.9 ? "success" : "warning"}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSummaryRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Box py={3}>
                            <Typography color="text.secondary">No data for this period. Generate challans first.</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      )}
    </AppShell>
  );
}
