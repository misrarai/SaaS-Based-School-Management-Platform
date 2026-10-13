import { useState } from "react";
import {
  Box,
  Button,
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChartOutlined";
import RefreshIcon from "@mui/icons-material/RefreshOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { getAnalytics } from "../../../api/attendance";
import { listClasses, listSections } from "../../../api/classes";

function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 120 }}>
      <CardContent sx={{ textAlign: "center", py: 2 }}>
        <Typography variant="h4" fontWeight={700} color={color}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function AttendanceReportsPage() {
  const [tab, setTab] = useState(0);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const sections = useQuery({
    queryKey: ["sections", classId],
    queryFn: () => listSections(classId),
    enabled: !!classId,
  });

  const analytics = useQuery({
    queryKey: ["attendance-analytics", classId, sectionId, dateFrom, dateTo],
    queryFn: () =>
      getAnalytics({
        classGradeId: classId || undefined,
        sectionId: sectionId || undefined,
        dateFrom,
        dateTo,
      }),
  });

  const data = analytics.data;

  return (
    <AppShell navItems={adminNavItems} title="Attendance Reports">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <BarChartIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Attendance Reports
          </Typography>
        </Stack>

        <Paper variant="outlined">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Summary Analytics" />
            <Tab label="Daily Attendance" />
          </Tabs>

          <Stack spacing={2} sx={{ p: 2 }}>
            {/* Filters */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Class</InputLabel>
                <Select
                  value={classId}
                  label="Class"
                  onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}
                >
                  <MenuItem value="">All Classes</MenuItem>
                  {(classes.data || []).map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {classId && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Section</InputLabel>
                  <Select
                    value={sectionId}
                    label="Section"
                    onChange={(e) => setSectionId(e.target.value)}
                  >
                    <MenuItem value="">All Sections</MenuItem>
                    {(sections.data || []).map((s) => (
                      <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 14 }}
                />
                <Typography variant="body2">to</Typography>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 14 }}
                />
              </Box>

              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => analytics.refetch()}
                variant="outlined"
              >
                Refresh
              </Button>
            </Stack>

            {analytics.isLoading && <LinearProgress />}

            {/* SUMMARY TAB */}
            {tab === 0 && data && (
              <Stack spacing={3}>
                {/* Stat cards */}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <StatCard label="Present" value={data.present} color="success.main" />
                  <StatCard label="Absent" value={data.absent} color="error.main" />
                  <StatCard label="Late" value={data.late} color="warning.main" />
                  <StatCard label="Excused" value={data.excused} color="info.main" />
                  <StatCard label="Total Sessions" value={data.total} color="text.primary" />
                </Stack>

                {/* Attendance rate */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Overall Attendance Rate
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <LinearProgress
                      variant="determinate"
                      value={data.percentage}
                      sx={{ flex: 1, height: 12, borderRadius: 6 }}
                      color={data.percentage >= 85 ? "success" : data.percentage >= 70 ? "warning" : "error"}
                    />
                    <Chip
                      label={`${data.percentage.toFixed(1)}%`}
                      color={data.percentage >= 85 ? "success" : data.percentage >= 70 ? "warning" : "error"}
                      size="small"
                    />
                  </Stack>
                </Paper>

                {/* Breakdown table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={darkTableHeadSx}>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Percentage</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(["present", "absent", "late", "excused"] as const).map((status) => (
                        <TableRow key={status} hover>
                          <TableCell>
                            <Chip
                              size="small"
                              label={status}
                              color={
                                status === "present" ? "success"
                                : status === "absent" ? "error"
                                : status === "late" ? "warning"
                                : "info"
                              }
                            />
                          </TableCell>
                          <TableCell align="right">{data[status]}</TableCell>
                          <TableCell align="right">
                            {pct(data[status], data.total)}%
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell><strong>Total</strong></TableCell>
                        <TableCell align="right"><strong>{data.total}</strong></TableCell>
                        <TableCell align="right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}

            {/* DAILY TAB */}
            {tab === 1 && (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Daily attendance is marked per class session. Go to{" "}
                  <strong>Attendance → Take Attendance</strong> to mark attendance for
                  today. Use the filters above to narrow analytics by class, section, or
                  date range.
                </Typography>
                {data && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Period: {dateFrom} → {dateTo}
                    </Typography>
                    <Typography variant="body2">
                      <strong>{data.present}</strong> present ·{" "}
                      <strong>{data.absent}</strong> absent ·{" "}
                      <strong>{data.late}</strong> late ·{" "}
                      <strong>{data.percentage.toFixed(1)}%</strong> rate
                    </Typography>
                  </Paper>
                )}
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </AppShell>
  );
}
