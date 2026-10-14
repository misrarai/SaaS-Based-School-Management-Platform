import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SchoolIcon from "@mui/icons-material/School";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ManIcon from "@mui/icons-material/Man";
import WomanIcon from "@mui/icons-material/Woman";
import SearchIcon from "@mui/icons-material/Search";
import { getStudentAnalytics, type StudentAnalytics } from "../../../api/dashboard";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  sublabel: string;
  value: number | string | undefined;
  icon: React.ReactNode;
  color: string;
  valueColor?: string;
  isLoading?: boolean;
}

function StatCard({ label, sublabel, value, icon, color, valueColor, isLoading }: StatCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>
              {label}
            </Typography>
            {isLoading ? (
              <Skeleton width={60} height={40} />
            ) : (
              <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1, color: valueColor ?? "text.primary" }}>
                {value}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">{sublabel}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Bar row for Gender / Status / Category ────────────────────────────────────

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{count}</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: "action.hover",
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 4 },
        }}
      />
    </Box>
  );
}

// ── Chart section card ────────────────────────────────────────────────────────

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          {icon}
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {children}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Active: "#22c55e",
  Transferred: "#06b6d4",
  Alumni: "#3b82f6",
  Withdrawn: "#f97316",
  Inactive: "#f97316",
};

const GENDER_COLORS: Record<string, string> = {
  Male: "#3b82f6",
  Female: "#ec4899",
  Other: "#8b5cf6",
};

export function StudentAnalyticsPage() {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [appliedFrom, setAppliedFrom] = useState(monthStart());
  const [appliedTo, setAppliedTo] = useState(today());

  const { data, isLoading } = useQuery<StudentAnalytics>({
    queryKey: ["student-analytics", appliedFrom, appliedTo],
    queryFn: () => getStudentAnalytics(appliedFrom, appliedTo),
  });

  const totalForStatus = data?.by_status.reduce((s, r) => s + r.count, 0) ?? 1;
  const totalForGender = data?.gender_split.reduce((s, r) => s + r.count, 0) ?? 1;

  return (
    <AppShell navItems={adminNavItems} title="Student Analytics">
      {/* Filter bar */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <TrendingUpIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Student Analytics</Typography>
        </Stack>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={3}>
            <TextField
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={() => { setAppliedFrom(dateFrom); setAppliedTo(dateTo); }}
              sx={{ height: 40 }}
            >
              Apply
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Active Students"
            sublabel="Currently enrolled"
            value={data?.active}
            icon={<PersonAddIcon />}
            color="#22c55e"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Transferred"
            sublabel="Moved out"
            value={data?.transferred}
            icon={<SwapHorizIcon />}
            color="#06b6d4"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Alumni"
            sublabel="Passed out"
            value={data?.alumni}
            icon={<SchoolIcon />}
            color="#3b82f6"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Left / Inactive"
            sublabel="No longer attending"
            value={data?.left_inactive}
            icon={<PersonOffIcon />}
            color="#f97316"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="At Risk"
            sublabel="Attendance below 75%"
            value={data?.at_risk}
            icon={<WarningAmberIcon />}
            color="#ef4444"
            valueColor="#ef4444"
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Avg Attendance"
            sublabel="Selected date range"
            value={data?.avg_attendance_pct != null ? `${data.avg_attendance_pct}%` : "N/A"}
            icon={<CalendarMonthIcon />}
            color="#7c3aed"
            isLoading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Charts row */}
      <Grid container spacing={2}>
        {/* Gender Split */}
        <Grid item xs={12} md={4}>
          <ChartCard
            title="Gender Split"
            icon={
              <Stack direction="row" spacing={0.5}>
                <ManIcon sx={{ color: "#3b82f6" }} />
                <WomanIcon sx={{ color: "#ec4899" }} />
              </Stack>
            }
          >
            {isLoading ? (
              <Skeleton height={80} />
            ) : (data?.gender_split.length ?? 0) === 0 ? (
              <Typography variant="body2" color="text.secondary">No gender data recorded yet.</Typography>
            ) : (
              <>
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                  {data!.gender_split.map((g) => (
                    <Stack key={g.label} direction="row" spacing={0.5} alignItems="center">
                      {g.label === "Male" ? <ManIcon sx={{ color: "#3b82f6", fontSize: 18 }} /> : <WomanIcon sx={{ color: "#ec4899", fontSize: 18 }} />}
                      <Typography variant="body2" color={g.label === "Male" ? "#3b82f6" : "#ec4899"} fontWeight={600}>
                        {g.label} {g.count}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
                {data!.gender_split.map((g) => (
                  <BarRow
                    key={g.label}
                    label={g.label}
                    count={g.count}
                    total={totalForGender}
                    color={GENDER_COLORS[g.label] ?? "#6b7280"}
                  />
                ))}
              </>
            )}
          </ChartCard>
        </Grid>

        {/* By Status */}
        <Grid item xs={12} md={4}>
          <ChartCard title="By Status" icon={<TrendingUpIcon color="primary" />}>
            {isLoading ? (
              <Skeleton height={80} />
            ) : (
              data?.by_status.map((s) => (
                <BarRow
                  key={s.label}
                  label={s.label}
                  count={s.count}
                  total={totalForStatus}
                  color={STATUS_COLORS[s.label] ?? "#6b7280"}
                />
              ))
            )}
          </ChartCard>
        </Grid>

        {/* Total summary */}
        <Grid item xs={12} md={4}>
          <ChartCard title="Summary" icon={<SchoolIcon color="primary" />}>
            {isLoading ? (
              <Skeleton height={80} />
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Registered</Typography>
                  <Typography variant="h3" fontWeight={700}>{data?.total ?? 0}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary">Active Rate</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {data && data.total > 0 ? `${Math.round((data.active / data.total) * 100)}%` : "—"}
                  </Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary">Avg Attendance ({appliedFrom} → {appliedTo})</Typography>
                  <Typography variant="h5" fontWeight={700} color="secondary.main">
                    {data?.avg_attendance_pct != null ? `${data.avg_attendance_pct}%` : "N/A"}
                  </Typography>
                </Box>
              </Stack>
            )}
          </ChartCard>
        </Grid>
      </Grid>
    </AppShell>
  );
}
