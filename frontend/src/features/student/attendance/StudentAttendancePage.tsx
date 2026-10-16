import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
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
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { getStudentSummary } from "../../../api/attendance";
import { getMyStudentProfile } from "../../../api/students";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "success" | "error" | "warning" | "info"> = {
    present: "success",
    absent: "error",
    late: "warning",
    excused: "info",
  };
  return <Chip size="small" label={status} color={map[status] ?? "default"} />;
}

export function StudentAttendancePage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const profile = useQuery({ queryKey: ["students", "me"], queryFn: getMyStudentProfile });

  const summary = useQuery({
    queryKey: ["attendance-summary", profile.data?.id, month, year],
    queryFn: () => getStudentSummary(profile.data!.id, month, year),
    enabled: !!profile.data?.id,
  });

  const data = summary.data;
  const percentage = data?.percentage ?? 0;
  const statusColor =
    percentage >= 90 ? "success" : percentage >= 75 ? "warning" : "error";

  return (
    <AppShell navItems={studentNavItems} title="My Attendance">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <FactCheckIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            My Attendance
          </Typography>
        </Stack>

        {/* Month/Year picker */}
        <Stack direction="row" spacing={2}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={month}
              label="Month"
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <MenuItem key={i} value={i + 1}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={year}
              label="Year"
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[today.getFullYear() - 1, today.getFullYear()].map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {summary.isLoading && <LinearProgress />}

        {/* Summary cards */}
        {data && (
          <>
            {/* Attendance rate */}
            <Card
              variant="outlined"
              sx={{
                borderRadius: 2,
                borderColor: `${statusColor}.main`,
                borderWidth: 2,
              }}
            >
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Attendance Rate — {MONTHS[month - 1]} {year}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography variant="h3" fontWeight={800} color={`${statusColor}.main`}>
                    {percentage}%
                  </Typography>
                  <Chip
                    label={
                      percentage >= 90
                        ? "Excellent! 🎉"
                        : percentage >= 75
                        ? "Good 👍"
                        : "Needs Improvement ⚠️"
                    }
                    color={statusColor}
                    size="small"
                  />
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  color={statusColor}
                  sx={{ mt: 1.5, height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>

            {/* Stats row */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              {[
                { label: "Present", value: data.present, color: "success.main" },
                { label: "Absent", value: data.absent, color: "error.main" },
                { label: "Late", value: data.late, color: "warning.main" },
                { label: "Excused", value: data.excused, color: "info.main" },
              ].map((item) => (
                <Paper
                  key={item.label}
                  variant="outlined"
                  sx={{ flex: 1, p: 2, textAlign: "center", borderRadius: 2 }}
                >
                  <Typography variant="h4" fontWeight={700} color={item.color}>
                    {item.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                </Paper>
              ))}
            </Stack>

            {/* Advice */}
            {percentage < 75 && (
              <Box
                sx={{
                  bgcolor: "error.lighter",
                  border: "1px solid",
                  borderColor: "error.light",
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Typography variant="body2" color="error.dark" fontWeight={600}>
                  ⚠️ Your attendance is below 75%. Please attend classes regularly.
                  Low attendance may affect your exam eligibility.
                </Typography>
              </Box>
            )}

            {/* Summary table */}
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell align="right"><strong>Days</strong></TableCell>
                    <TableCell align="right"><strong>%</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(["present", "absent", "late", "excused"] as const).map((s) => (
                    <TableRow key={s}>
                      <TableCell><StatusBadge status={s} /></TableCell>
                      <TableCell align="right">{data[s]}</TableCell>
                      <TableCell align="right">
                        {data.total ? Math.round((data[s] / data.total) * 100) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell><strong>Total</strong></TableCell>
                    <TableCell align="right"><strong>{data.total}</strong></TableCell>
                    <TableCell align="right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </>
        )}

        {!summary.isLoading && !data && (
          <Typography color="text.secondary">
            No attendance recorded for {MONTHS[month - 1]} {year}.
          </Typography>
        )}
      </Stack>
    </AppShell>
  );
}
