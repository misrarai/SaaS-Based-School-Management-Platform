import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
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
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PeopleIcon from "@mui/icons-material/People";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  getClassCollectionSummary,
  getDailyCollectionReport,
  listDefaulters,
} from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const MONTHS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function StatCard({ title, value, sub, color, icon }: { title: string; value: string; sub?: string; color?: string; icon: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 180, borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary">{title}</Typography>
            <Typography variant="h5" fontWeight={700} color={color ?? "text.primary"}>{value}</Typography>
            {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
          </Box>
          <Box sx={{ color: color ?? "text.secondary", opacity: 0.7 }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function FeeAnalyticsPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const summaryQuery = useQuery({
    queryKey: ["analytics-class-summary", month, year],
    queryFn: () => getClassCollectionSummary({ period_month: month, period_year: year }),
  });

  const dailyQuery = useQuery({
    queryKey: ["analytics-daily", today.toISOString().split("T")[0]],
    queryFn: () => getDailyCollectionReport({
      date_from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0],
      date_to: today.toISOString().split("T")[0],
    }),
  });

  const defaultersQuery = useQuery({
    queryKey: ["analytics-defaulters"],
    queryFn: () => listDefaulters({ months_overdue: 1 }),
  });

  const summary = summaryQuery.data;
  const daily = dailyQuery.data;
  const defaulters = defaultersQuery.data ?? [];

  const collectionRate = summary && summary.total_billed > 0
    ? Math.round((summary.total_collected / summary.total_billed) * 100)
    : 0;

  const topDefaulters = [...defaulters]
    .sort((a, b) => b.overdue_balance - a.overdue_balance)
    .slice(0, 10);

  return (
    <AppShell title="Fee Analytics" navItems={adminNavItems}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TrendingUpIcon color="primary" />
          <Typography variant="h4">Fee Analytics</Typography>
        </Stack>
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Month</InputLabel>
            <Select value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.slice(1).map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {/* KPI cards */}
      <Stack direction="row" spacing={2} flexWrap="wrap" mb={3}>
        <StatCard
          title="Total Billed"
          value={summary ? fmt(summary.total_billed) : "—"}
          sub={`${MONTHS[month]} ${year}`}
          color="primary.main"
          icon={<AccountBalanceIcon fontSize="large" />}
        />
        <StatCard
          title="Collected"
          value={summary ? fmt(summary.total_collected) : "—"}
          sub={`${collectionRate}% collection rate`}
          color="success.main"
          icon={<TrendingUpIcon fontSize="large" />}
        />
        <StatCard
          title="Outstanding"
          value={summary ? fmt(summary.total_outstanding) : "—"}
          sub="Remaining this month"
          color={summary && summary.total_outstanding > 0 ? "error.main" : "success.main"}
          icon={<AccountBalanceIcon fontSize="large" />}
        />
        <StatCard
          title="Defaulters"
          value={String(defaulters.length)}
          sub="1+ month overdue"
          color={defaulters.length > 0 ? "error.main" : "success.main"}
          icon={<WarningAmberIcon fontSize="large" />}
        />
        <StatCard
          title="This Month Collected"
          value={daily ? fmt(daily.total) : "—"}
          sub={`${daily?.payments.length ?? 0} transactions`}
          color="info.main"
          icon={<PeopleIcon fontSize="large" />}
        />
      </Stack>

      {/* Collection rate by class */}
      {summary && summary.rows.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} p={2}>
            Collection Rate by Class — {MONTHS[month]} {year}
          </Typography>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Class</TableCell>
                <TableCell align="right">Students</TableCell>
                <TableCell align="right">Billed</TableCell>
                <TableCell align="right">Collected</TableCell>
                <TableCell align="right">Outstanding</TableCell>
                <TableCell align="right">Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.rows.map((r) => {
                const rate = r.billed > 0 ? Math.round((r.collected / r.billed) * 100) : 0;
                return (
                  <TableRow key={r.class_grade_id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{r.class_grade_name}</TableCell>
                    <TableCell align="right">{r.students}</TableCell>
                    <TableCell align="right">{fmt(r.billed)}</TableCell>
                    <TableCell align="right" sx={{ color: "success.main" }}>{fmt(r.collected)}</TableCell>
                    <TableCell align="right" sx={{ color: r.outstanding > 0 ? "error.main" : "text.primary" }}>{fmt(r.outstanding)}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${rate}%`}
                        size="small"
                        color={rate >= 90 ? "success" : rate >= 60 ? "warning" : "error"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Payment method breakdown */}
      {daily && Object.keys(daily.by_method).length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} p={2}>
            This Month — Collection by Payment Method
          </Typography>
          <Stack direction="row" spacing={2} p={2} flexWrap="wrap">
            {Object.entries(daily.by_method).map(([method, amount]) => (
              <Card key={method} variant="outlined" sx={{ minWidth: 150, borderRadius: 2 }}>
                <CardContent sx={{ pb: "12px !important" }}>
                  <Typography variant="caption" color="text.secondary">{method}</Typography>
                  <Typography fontWeight={700}>{fmt(amount)}</Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Top defaulters */}
      {topDefaulters.length > 0 && (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" p={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <WarningAmberIcon color="error" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={600}>Top Defaulters</Typography>
            </Stack>
            <Chip label={`${defaulters.length} total`} color="error" size="small" />
          </Stack>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Class</TableCell>
                <TableCell align="right">Overdue Months</TableCell>
                <TableCell align="right">Overdue Balance</TableCell>
                <TableCell>Oldest Due</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topDefaulters.map((d) => (
                <TableRow key={d.student_id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{d.student_name}</TableCell>
                  <TableCell>{d.class_grade_name ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Chip label={`${d.months_overdue}m`} size="small" color="error" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>
                    {fmt(d.overdue_balance)}
                  </TableCell>
                  <TableCell>{d.oldest_due_date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {!summaryQuery.isLoading && !summary?.rows.length && (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary">
            No analytics data available for {MONTHS[month]} {year}. Generate monthly challans first.
          </Typography>
        </Box>
      )}
    </AppShell>
  );
}
