import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  Chip,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroomOutlined";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmptyOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import WorkIcon from "@mui/icons-material/WorkOutlined";
import PointOfSaleIcon from "@mui/icons-material/PointOfSaleOutlined";
import VerifiedIcon from "@mui/icons-material/VerifiedOutlined";
import CakeIcon from "@mui/icons-material/CakeOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import SmsIcon from "@mui/icons-material/SmsOutlined";
import AddCircleIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAddAltOutlined";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";
import { getDashboardSummary, type DashboardOverview } from "../../api/dashboard";
import { useAuth } from "../../auth/AuthContext";
import { darkTableHeadSx } from "../../components/tableStyles";
import { tileColors } from "../../theme";

const PKR_FMT = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const pkr = (n: number | undefined) => `PKR ${PKR_FMT.format(n ?? 0)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_COLORS = {
  present: "#27ae60",
  absent: "#eb5757",
  late: "#f2994a",
  leave: "#9b51e0",
  half_day: "#2f80ed",
  not_marked: "#c4cbd4",
};
const CASH_IN = "#0f9d8e";
const CASH_OUT = "#f2994a";
const ADMIT = "#2f80ed";
const WITHDRAW = "#eb5757";

function Tile({
  icon,
  label,
  value,
  sub,
  color,
  to,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color: string;
  to?: string;
}) {
  const body = (
    <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5, color: "#fff", minHeight: 96 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 12.5, opacity: 0.9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 }} noWrap>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }} noWrap>
          {value}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: 12, opacity: 0.85 }} noWrap>
            {sub}
          </Typography>
        )}
      </Box>
      <Box sx={{ opacity: 0.35, "& svg": { fontSize: 44 } }}>{icon}</Box>
    </Box>
  );
  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: color,
        borderRadius: 2,
        height: "100%",
        transition: "transform .15s, box-shadow .15s",
        "&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
      }}
    >
      {to ? (
        <CardActionArea component={RouterLink} to={to} sx={{ height: "100%" }}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction="row"
        sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider", alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      <Box sx={{ p: 2, flex: 1 }}>{children}</Box>
    </Paper>
  );
}

function Donut({ data, total }: { data: { name: string; value: number; color: string }[]; total: number }) {
  const nonEmpty = data.filter((d) => d.value > 0);
  const present = data.find((d) => d.name === "Present")?.value ?? 0;
  const pct = total ? Math.round((present / total) * 100) : 0;
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
      <Box sx={{ position: "relative", width: 170, height: 170, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={nonEmpty.length ? nonEmpty : [{ name: "No data", value: 1, color: "#e5e9ec" }]}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={78}
              startAngle={90}
              endAngle={-270}
              stroke="#fff"
              strokeWidth={2}
            >
              {(nonEmpty.length ? nonEmpty : [{ color: "#e5e9ec" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            {nonEmpty.length > 0 && <Tooltip />}
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <Typography sx={{ fontWeight: 700, fontSize: 22 }}>{total ? `${pct}%` : "—"}</Typography>
          <Typography variant="caption" color="text.secondary">
            present
          </Typography>
        </Box>
      </Box>
      <Stack spacing={0.75} sx={{ flex: 1, width: "100%" }}>
        {data.map((d) => (
          <Stack key={d.name} direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: d.color }} />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {d.name}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {d.value}
            </Typography>
          </Stack>
        ))}
        <Typography variant="caption" color="text.secondary">
          Total: {total}
        </Typography>
      </Stack>
    </Stack>
  );
}

function channelIcon(channel: string) {
  if (channel === "whatsapp") return <WhatsAppIcon sx={{ color: "#25d366" }} />;
  if (channel === "email") return <EmailIcon sx={{ color: tileColors.blue }} />;
  return <SmsIcon sx={{ color: tileColors.purple }} />;
}

function ReceivableTable({ o }: { o: DashboardOverview }) {
  const r = o.receivable_report;
  const byMonth = new Map(r.months.map((m) => [m.month, m.amount]));
  const cells: { label: string; value: number }[] = [
    { label: `Before ${r.year}`, value: r.previous_balance },
    ...MONTHS.map((m, i) => ({ label: m, value: byMonth.get(i + 1) ?? 0 })),
    { label: `${r.year + 1}+`, value: r.next_year_balance },
    { label: "Total", value: r.total },
  ];
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead sx={darkTableHeadSx}>
          <TableRow>
            {cells.map((c) => (
              <TableCell key={c.label} align="right" sx={{ whiteSpace: "nowrap" }}>
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            {cells.map((c) => (
              <TableCell
                key={c.label}
                align="right"
                sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontWeight: c.label === "Total" ? 700 : 400 }}
              >
                {PKR_FMT.format(c.value)}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function QuickAction({ icon, label, to }: { icon: ReactNode; label: string; to: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%", "&:hover": { boxShadow: 3 } }}>
      <CardActionArea component={RouterLink} to={to} sx={{ p: 2, textAlign: "center", height: "100%" }}>
        <Box sx={{ color: "primary.main", mb: 0.5 }}>{icon}</Box>
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
  const o = s?.overview;
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long" });
  const payoutLabel = o ? `${MONTHS[o.payout_period_month - 1]} ${o.payout_period_year}` : "";

  const studentDonut = o
    ? [
        { name: "Present", value: o.student_attendance.present, color: STATUS_COLORS.present },
        { name: "Absent", value: o.student_attendance.absent, color: STATUS_COLORS.absent },
        { name: "Late", value: o.student_attendance.late, color: STATUS_COLORS.late },
        { name: "Leave", value: o.student_attendance.leave, color: STATUS_COLORS.leave },
        { name: "Not marked", value: o.student_attendance.not_marked, color: STATUS_COLORS.not_marked },
      ]
    : [];
  const hrDonut = o
    ? [
        { name: "Present", value: o.hr_attendance.present, color: STATUS_COLORS.present },
        { name: "Absent", value: o.hr_attendance.absent, color: STATUS_COLORS.absent },
        { name: "Late", value: o.hr_attendance.late, color: STATUS_COLORS.late },
        { name: "Half day", value: o.hr_attendance.half_day, color: STATUS_COLORS.half_day },
        { name: "Leave", value: o.hr_attendance.leave, color: STATUS_COLORS.leave },
        { name: "Not marked", value: o.hr_attendance.not_marked, color: STATUS_COLORS.not_marked },
      ]
    : [];

  const loading = summaryQuery.isLoading;
  const v = (value: ReactNode) => (loading ? "…" : value);

  return (
    <AppShell title="Dashboard" navItems={adminNavItems}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2.5, gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Welcome back, {user?.full_name?.split(" ")[0]}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            School overview for {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </Typography>
        </Box>
        {s && (
          <Chip
            label={`${s.online_classes_today} online classes today`}
            component={RouterLink}
            to="/admin/schedule"
            clickable
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>

      {summaryQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load dashboard data.
        </Alert>
      )}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Tile
            icon={<SchoolIcon />}
            label="Total Students"
            value={v(o?.total_students_all ?? s?.total_students ?? 0)}
            sub={s ? `${s.total_students} active` : undefined}
            color={tileColors.blue}
            to="/admin/students?status=active"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Tile
            icon={<FamilyRestroomIcon />}
            label="Active Families"
            value={v(o?.active_families ?? s?.total_families ?? 0)}
            color={tileColors.teal}
            to="/admin/families"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Tile
            icon={<BadgeIcon />}
            label="Active Staff / Total Staff"
            value={v(o ? `${o.active_staff_all} / ${o.total_staff_all}` : s?.total_staff ?? 0)}
            sub="incl. teachers"
            color={tileColors.purple}
            to="/admin/staff?status=active"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Tile
            icon={<ReceiptLongIcon />}
            label={`Fee This Month (${monthName})`}
            value={v(pkr(o?.fee_this_month))}
            color={tileColors.navy}
            to="/admin/fees/invoices"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Tile
            icon={<PaymentsIcon />}
            label="Received This Month"
            value={v(pkr(o?.received_this_month ?? s?.fees_collected_this_month))}
            color={tileColors.green}
            to="/admin/fees/payments/all"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Tile
            icon={<HourglassEmptyIcon />}
            label="Receivable This Month"
            value={v(pkr(o?.receivable_this_month))}
            color={tileColors.orange}
            to="/admin/fees/invoices"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Tile
            icon={<AccountBalanceWalletIcon />}
            label="Total Receivable"
            value={v(pkr(o?.total_receivable ?? (s ? s.fees_pending + s.fees_overdue : 0)))}
            sub={s ? `${pkr(s.fees_overdue)} overdue` : undefined}
            color={tileColors.red}
            to="/admin/fees/reports"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Tile
            icon={<WorkIcon />}
            label={`Salary ${payoutLabel}`}
            value={v(pkr(o?.salary_last_month))}
            sub={o ? `Paid ${pkr(o.paid_last_month)} · Payable ${pkr(o.total_payable)}` : undefined}
            color={tileColors.pink}
            to="/admin/payouts"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6, lg: 6 }}>
          <Tile
            icon={<PointOfSaleIcon />}
            label="Today's Collection"
            value={v(pkr(o?.today_collection))}
            sub={o ? `${o.today_payments_count} payment${o.today_payments_count === 1 ? "" : "s"} verified today` : undefined}
            color={tileColors.cyan}
            to="/admin/fees/receipts"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6, lg: 6 }}>
          <Tile
            icon={<VerifiedIcon />}
            label="Pending Verification"
            value={v(o ? `${o.pending_verification_count}` : 0)}
            sub={o ? `${pkr(o.pending_verification_amount)} awaiting approval` : undefined}
            color={tileColors.amber}
            to="/admin/fees/payments"
          />
        </Grid>
      </Grid>

      {o && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Panel title="Student Attendance Today" action={<Chip size="small" label="Details" component={RouterLink} to="/admin/attendance" clickable />}>
                <Donut data={studentDonut} total={o.student_attendance.total} />
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Panel title="HR Attendance Today" action={<Chip size="small" label="Details" component={RouterLink} to="/admin/attendance/staff" clickable />}>
                <Donut data={hrDonut} total={o.hr_attendance.total} />
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, md: 12, lg: 4 }}>
              <Stack spacing={2} sx={{ height: "100%" }}>
                <Panel title="Birthdays Today">
                  {o.birthdays_today.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No birthdays today.
                    </Typography>
                  ) : (
                    <List dense disablePadding sx={{ maxHeight: 150, overflowY: "auto" }}>
                      {o.birthdays_today.map((name) => (
                        <ListItem key={name} disableGutters>
                          <ListItemAvatar sx={{ minWidth: 44 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: tileColors.pink }}>
                              <CakeIcon fontSize="small" />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText primary={name} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Panel>
                <Panel title="Messaging Usage Today">
                  <Stack spacing={1.25}>
                    {o.messaging_today.map((m) => (
                      <Stack key={m.channel} direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                        {channelIcon(m.channel)}
                        <Typography variant="body2" sx={{ flex: 1, textTransform: "capitalize" }}>
                          {m.channel}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {m.sent} / {m.total} sent
                        </Typography>
                      </Stack>
                    ))}
                    {o.messaging_today.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No messages today.
                      </Typography>
                    )}
                  </Stack>
                </Panel>
              </Stack>
            </Grid>
          </Grid>

          <Box sx={{ mb: 2.5 }}>
            <Panel title={`Receivable Report — ${o.receivable_report.year} (PKR)`}>
              <ReceivableTable o={o} />
            </Panel>
          </Box>

          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <Panel title={`Cash Flow — ${monthName} (month to date)`}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={o.cash_flow} margin={{ left: 0, right: 8 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9ec" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60} tickFormatter={(n) => PKR_FMT.format(Number(n))} />
                    <Tooltip
                      formatter={(value, name) => [pkr(Number(value)), name]}
                      labelFormatter={(d) => `${monthName} ${d}`}
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="cash_in" name="Cash in" fill={CASH_IN} radius={[4, 4, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="cash_out" name="Cash out" fill={CASH_OUT} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <Panel title={`Admissions vs Withdrawals — ${monthName}`}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={o.admissions} margin={{ left: -16, right: 8 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9ec" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip labelFormatter={(d) => `${monthName} ${d}`} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="admissions" name="Admissions" fill={ADMIT} radius={[4, 4, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="withdrawals" name="Withdrawals" fill={WITHDRAW} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </Grid>
          </Grid>
        </>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Quick actions
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <QuickAction icon={<PersonAddIcon fontSize="large" />} label="Register Student" to="/admin/students/register" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <QuickAction icon={<AddCircleIcon fontSize="large" />} label="Create Online Class" to="/admin/schedule?create=online" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <QuickAction icon={<FactCheckIcon fontSize="large" />} label="Mark Staff Attendance" to="/admin/attendance/staff" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <QuickAction icon={<HourglassEmptyIcon fontSize="large" />} label="Pending Payments" to="/admin/fees/payments/pending" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <QuickAction icon={<CampaignIcon fontSize="large" />} label="Send Notification" to="/admin/notifications" />
        </Grid>
      </Grid>
    </AppShell>
  );
}
