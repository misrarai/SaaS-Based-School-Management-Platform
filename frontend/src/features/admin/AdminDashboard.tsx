import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import GroupIcon from "@mui/icons-material/GroupOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroomOutlined";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmptyOutlined";
import VideoCameraFrontIcon from "@mui/icons-material/VideoCameraFrontOutlined";
import AddCircleIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";
import { getDashboardSummary, type AttendanceToday } from "../../api/dashboard";
import { useAuth } from "../../auth/AuthContext";

const PKR = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function StatCard({
  icon,
  label,
  value,
  to,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to: string;
  color: string;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, transition: "box-shadow .2s, transform .2s", "&:hover": { boxShadow: 4, transform: "translateY(-2px)" } }}>
      <CardActionArea component={RouterLink} to={to} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: (theme) => `linear-gradient(135deg, ${theme.palette[color as "primary"].light}, ${theme.palette[color as "primary"].main})`,
              color: "#fff",
              boxShadow: 2,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

const RING_COLORS: Record<string, string> = { good: "#0f9d8e", warn: "#f0a83a", bad: "#e05252" };

function ringColor(percentage: number) {
  if (percentage >= 90) return RING_COLORS.good;
  if (percentage >= 75) return RING_COLORS.warn;
  return RING_COLORS.bad;
}

function AttendanceRing({ label, data, to }: { label: string; data: AttendanceToday | undefined; to: string }) {
  const percentage = data?.percentage ?? 0;
  const color = ringColor(percentage);
  const chartData = [
    { name: "present", value: data?.present ?? 0 },
    { name: "rest", value: Math.max((data?.total ?? 0) - (data?.present ?? 0), 0) },
  ];
  const isEmpty = !data || data.total === 0;

  return (
    <Card
      variant="outlined"
      component={RouterLink}
      to={to}
      sx={{ borderRadius: 3, textDecoration: "none", display: "block", transition: "box-shadow .2s", "&:hover": { boxShadow: 4 } }}
    >
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {label}
        </Typography>
        <Box sx={{ position: "relative", width: 128, height: 128, mx: "auto" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={isEmpty ? [{ name: "empty", value: 1 }] : chartData}
                dataKey="value"
                innerRadius={42}
                outerRadius={58}
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {isEmpty ? (
                  <Cell fill="#e5e9ec" />
                ) : (
                  <>
                    <Cell fill={color} />
                    <Cell fill="#e5e9ec" />
                  </>
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: isEmpty ? "text.secondary" : color }}>
              {isEmpty ? "—" : `${percentage}%`}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "center", mt: 1.5, flexWrap: "wrap" }}>
          <Chip size="small" label={`${data?.present ?? 0} present`} color="success" variant="outlined" />
          <Chip size="small" label={`${data?.absent ?? 0} absent`} color="error" variant="outlined" />
        </Stack>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon, label, to, color }: { icon: React.ReactNode; label: string; to: string; color: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, transition: "box-shadow .2s, transform .2s", "&:hover": { boxShadow: 4, transform: "translateY(-2px)" } }}>
      <CardActionArea component={RouterLink} to={to} sx={{ p: 2, textAlign: "center" }}>
        <Box sx={{ color: `${color}.main`, mb: 1 }}>{icon}</Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </CardActionArea>
    </Card>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const summaryQuery = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary });
  const s = summaryQuery.data;

  const trendData = (s?.attendance_trend ?? []).map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString(undefined, { weekday: "short" }),
  }));

  return (
    <AppShell title="Admin Dashboard" navItems={adminNavItems}>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.full_name?.split(" ")[0]}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here's what's happening at your academy today.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard icon={<ClassIcon />} label="Classes" value={s?.total_classes ?? "…"} to="/admin/classes" color="primary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard icon={<GroupIcon />} label="Teachers" value={s?.total_teachers ?? "…"} to="/admin/teachers" color="secondary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard icon={<SchoolIcon />} label="Active Students" value={s?.total_students ?? "…"} to="/admin/students" color="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard icon={<FamilyRestroomIcon />} label="Families" value={s?.total_families ?? "…"} to="/admin/families" color="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard icon={<BadgeIcon />} label="Active Staff" value={s?.total_staff ?? "…"} to="/admin/staff" color="info" />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 2 }}>
        Attendance today
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <AttendanceRing label="Students" data={s?.students_attendance_today} to="/admin/attendance" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <AttendanceRing label="Teachers" data={s?.teachers_attendance_today} to="/admin/attendance/teachers" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <AttendanceRing label="Staff" data={s?.staff_attendance_today} to="/admin/attendance/staff" />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: "100%" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Student attendance — last 7 days
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ left: -20 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f9d8e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0f9d8e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9ec" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
                <Area type="monotone" dataKey="percentage" stroke="#0f9d8e" strokeWidth={2.5} fill="url(#trendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2} sx={{ height: "100%" }}>
            <Paper
              variant="outlined"
              component={RouterLink}
              to="/admin/fees/reports"
              sx={{ p: 2.5, borderRadius: 3, textDecoration: "none", display: "block", flex: 1 }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5 }}>
                <PaymentsIcon color="success" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Fees this month
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "success.main" }}>
                PKR {PKR.format(s?.fees_collected_this_month ?? 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                collected
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                <Chip size="small" label={`PKR ${PKR.format(s?.fees_pending ?? 0)} pending`} color="warning" variant="outlined" />
                <Chip size="small" label={`PKR ${PKR.format(s?.fees_overdue ?? 0)} overdue`} color="error" variant="outlined" />
              </Stack>
            </Paper>
            <Paper variant="outlined" component={RouterLink} to="/admin/schedule" sx={{ p: 2.5, borderRadius: 3, textDecoration: "none", display: "block" }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <VideoCameraFrontIcon color="primary" />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {s?.online_classes_today ?? "…"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Online classes today
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 2 }}>
        Quick actions
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <QuickAction icon={<AddCircleIcon fontSize="large" />} label="Create Online Class" to="/admin/schedule?create=online" color="primary" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <QuickAction icon={<FactCheckIcon fontSize="large" />} label="Mark Staff Attendance" to="/admin/attendance/staff" color="info" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <QuickAction icon={<HourglassEmptyIcon fontSize="large" />} label="Pending Payments" to="/admin/fees/payments/pending" color="warning" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <QuickAction icon={<CampaignIcon fontSize="large" />} label="Send Notification" to="/admin/notifications" color="secondary" />
        </Grid>
      </Grid>
    </AppShell>
  );
}
