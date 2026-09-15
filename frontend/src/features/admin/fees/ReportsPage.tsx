import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardContent, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { getReportSummary } from "../../../api/fees";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const METHOD_LABELS: Record<string, string> = {
  jazzcash: "JazzCash",
  easypaisa: "EasyPaisa",
  nayapay: "NayaPay",
  sadapay: "SadaPay",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  other: "Other",
};

function SummaryCard({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${color}.light`,
              color: `${color}.dark`,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ReportsPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const reportQuery = useQuery({
    queryKey: ["fees-report", month, year],
    queryFn: () => getReportSummary(month, year),
  });
  const report = reportQuery.data;

  return (
    <AppShell title="Fee Reports" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        How much came in, and what's still outstanding, for one billing period.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField select label="Month" size="small" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 160 }}>
          {MONTH_LABELS.map((label, i) => (
            <MenuItem key={label} value={i + 1}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Year" size="small" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
          {[year - 1, year, year + 1].map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {report && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <SummaryCard icon={<PaidOutlinedIcon />} label="Collected" value={`PKR ${report.total_collected.toLocaleString()}`} color="success" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <SummaryCard icon={<HourglassEmptyOutlinedIcon />} label="Outstanding" value={`PKR ${report.total_pending.toLocaleString()}`} color="warning" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <SummaryCard icon={<ErrorOutlineOutlinedIcon />} label="Overdue" value={`PKR ${report.total_overdue.toLocaleString()}`} color="error" />
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Collected by payment method
            </Typography>
            {Object.keys(report.by_method).length === 0 ? (
              <Typography color="text.secondary">Nothing collected for this period yet.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {Object.entries(report.by_method)
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, amount]) => (
                    <Stack key={method} direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                      <Typography>{METHOD_LABELS[method] ?? method}</Typography>
                      <Typography sx={{ fontWeight: 600 }}>PKR {amount.toLocaleString()}</Typography>
                    </Stack>
                  ))}
              </Stack>
            )}
          </Paper>
        </>
      )}
    </AppShell>
  );
}
