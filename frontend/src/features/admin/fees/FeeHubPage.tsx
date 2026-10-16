import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import PaymentsIcon from "@mui/icons-material/Payments";
import GroupIcon from "@mui/icons-material/Group";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CategoryIcon from "@mui/icons-material/Category";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SmsIcon from "@mui/icons-material/Sms";
import SettingsIcon from "@mui/icons-material/Settings";
import SecurityIcon from "@mui/icons-material/Security";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import {
  getDailyCollectionReport,
  getClassCollectionSummary,
  listDefaulters,
} from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

interface QuickAction {
  label: string;
  desc: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  badge?: string | number;
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, borderRadius: 3, borderLeft: `4px solid`, borderLeftColor: color, flex: 1, minWidth: 180 }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5}>
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={800} mt={0.5} color={color}>
            {value}
          </Typography>
          {sub && (
            <Typography variant="caption" color="text.secondary">
              {sub}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Paper>
  );
}

function ActionCard({ action, onClick }: { action: QuickAction; onClick: () => void }) {
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 3, transition: "box-shadow 0.15s", "&:hover": { boxShadow: 3 } }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2.5, height: "100%" }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2,
                bgcolor: `${action.color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: action.color,
              }}
            >
              {action.icon}
            </Box>
            {action.badge != null && action.badge !== 0 && (
              <Chip label={action.badge} size="small" color="error" sx={{ fontWeight: 700 }} />
            )}
          </Stack>
          <Box>
            <Typography fontWeight={700} fontSize={15}>
              {action.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" lineHeight={1.4}>
              {action.desc}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export function FeeHubPage() {
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const dailyQuery = useQuery({
    queryKey: ["fee-hub-daily", todayStr],
    queryFn: () => getDailyCollectionReport({ date_from: todayStr, date_to: todayStr }),
  });

  const monthlyQuery = useQuery({
    queryKey: ["fee-hub-monthly", today.getMonth() + 1, today.getFullYear()],
    queryFn: () => getClassCollectionSummary({ period_month: today.getMonth() + 1, period_year: today.getFullYear() }),
  });

  const defaultersQuery = useQuery({
    queryKey: ["fee-hub-defaulters"],
    queryFn: () => listDefaulters({ months_overdue: 1 }),
  });

  const todayTotal = dailyQuery.data?.total ?? 0;
  const todayTxns = dailyQuery.data?.payments.length ?? 0;
  const monthBilled = monthlyQuery.data?.total_billed ?? 0;
  const monthCollected = monthlyQuery.data?.total_collected ?? 0;
  const outstanding = monthlyQuery.data?.total_outstanding ?? 0;
  const defaultersCount = defaultersQuery.data?.length ?? 0;
  const collectionRate = monthBilled > 0 ? Math.round((monthCollected / monthBilled) * 100) : 0;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabel = `${MONTHS[today.getMonth()]} ${today.getFullYear()}`;

  const collectionActions: QuickAction[] = [
    {
      label: "Collect Fee",
      desc: "Search student and receive payment at counter",
      icon: <PaymentsIcon />,
      path: "/admin/fees/collect",
      color: "#1976d2",
    },
    {
      label: "Collect Family Fee",
      desc: "Collect dues for all children in a family together",
      icon: <GroupIcon />,
      path: "/admin/fees/collect-family",
      color: "#7b1fa2",
    },
    {
      label: "View Challan",
      desc: "Browse all generated challans and download PDFs",
      icon: <ReceiptLongIcon />,
      path: "/admin/fees/challan",
      color: "#0288d1",
    },
  ];

  const setupActions: QuickAction[] = [
    {
      label: "Create Challan",
      desc: "Generate monthly fee challans for one or all classes",
      icon: <AddCircleOutlineIcon />,
      path: "/admin/fees/create-challan",
      color: "#2e7d32",
    },
    {
      label: "Fee Heads",
      desc: "Manage fee categories (Tuition, Transport, etc.)",
      icon: <CategoryIcon />,
      path: "/admin/fees/heads",
      color: "#ed6c02",
    },
    {
      label: "Fee Structure",
      desc: "Set monthly amounts per class per fee head",
      icon: <AccountTreeIcon />,
      path: "/admin/fees/structure",
      color: "#c62828",
    },
  ];

  const reportActions: QuickAction[] = [
    {
      label: "Slips / Vouchers",
      desc: "Print fee slips for a class by month",
      icon: <PictureAsPdfIcon />,
      path: "/admin/fees/slips",
      color: "#0288d1",
    },
    {
      label: "Collection Reports",
      desc: "Daily collection and class-wise fee register",
      icon: <AssessmentIcon />,
      path: "/admin/fees/collection-reports",
      color: "#1976d2",
    },
    {
      label: "Fee Analytics",
      desc: "KPIs, collection rates and defaulter overview",
      icon: <TrendingUpIcon />,
      path: "/admin/fees/analytics",
      color: "#00897b",
    },
    {
      label: "Send SMS",
      desc: "Send fee reminder SMS to defaulting students",
      icon: <SmsIcon />,
      path: "/admin/fees/sms",
      color: "#f57c00",
      badge: defaultersCount || undefined,
    },
    {
      label: "Security Fee",
      desc: "View concessions and security deposits",
      icon: <SecurityIcon />,
      path: "/admin/fees/security",
      color: "#5c6bc0",
    },
    {
      label: "Fee Setting",
      desc: "Configure late fee rule and grace period",
      icon: <SettingsIcon />,
      path: "/admin/fees/settings",
      color: "#546e7a",
    },
  ];

  return (
    <AppShell title="Fee Management" navItems={adminNavItems}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Fee Management</Typography>
          <Typography color="text.secondary" variant="body2">
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </Typography>
        </Box>
        {collectionRate > 0 && (
          <Chip
            label={`${collectionRate}% collected · ${monthLabel}`}
            color={collectionRate >= 80 ? "success" : "warning"}
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        )}
      </Stack>

      {/* KPI Row */}
      <Stack direction="row" spacing={2} flexWrap="wrap" mb={4}>
        <StatCard
          label="Collected Today"
          value={fmt(todayTotal)}
          sub={`${todayTxns} transaction${todayTxns !== 1 ? "s" : ""}`}
          icon={<AccountBalanceWalletIcon />}
          color="#1976d2"
        />
        <StatCard
          label="This Month Billed"
          value={fmt(monthBilled)}
          sub={monthLabel}
          icon={<ReceiptLongIcon />}
          color="#7b1fa2"
        />
        <StatCard
          label="This Month Collected"
          value={fmt(monthCollected)}
          sub={`${collectionRate}% of billed`}
          icon={<TrendingUpIcon />}
          color="#2e7d32"
        />
        <StatCard
          label="Outstanding"
          value={fmt(outstanding)}
          sub="Remaining this month"
          icon={<TrendingDownIcon />}
          color={outstanding > 0 ? "#c62828" : "#2e7d32"}
        />
        <StatCard
          label="Defaulters"
          value={String(defaultersCount)}
          sub="1+ month overdue"
          icon={<WarningAmberIcon />}
          color={defaultersCount > 0 ? "#f57c00" : "#2e7d32"}
        />
      </Stack>

      {/* Collection */}
      <Typography variant="overline" fontWeight={700} color="text.secondary" letterSpacing={1.2}>
        Fee Collection
      </Typography>
      <Divider sx={{ mb: 2, mt: 0.5 }} />
      <Grid container spacing={2} mb={4}>
        {collectionActions.map((a) => (
          <Grid item xs={12} sm={6} md={4} key={a.path}>
            <ActionCard action={a} onClick={() => navigate(a.path)} />
          </Grid>
        ))}
      </Grid>

      {/* Setup */}
      <Typography variant="overline" fontWeight={700} color="text.secondary" letterSpacing={1.2}>
        Setup &amp; Configuration
      </Typography>
      <Divider sx={{ mb: 2, mt: 0.5 }} />
      <Grid container spacing={2} mb={4}>
        {setupActions.map((a) => (
          <Grid item xs={12} sm={6} md={4} key={a.path}>
            <ActionCard action={a} onClick={() => navigate(a.path)} />
          </Grid>
        ))}
      </Grid>

      {/* Reports */}
      <Typography variant="overline" fontWeight={700} color="text.secondary" letterSpacing={1.2}>
        Reports &amp; Tools
      </Typography>
      <Divider sx={{ mb: 2, mt: 0.5 }} />
      <Grid container spacing={2} mb={2}>
        {reportActions.map((a) => (
          <Grid item xs={12} sm={6} md={4} key={a.path}>
            <ActionCard action={a} onClick={() => navigate(a.path)} />
          </Grid>
        ))}
      </Grid>
    </AppShell>
  );
}
