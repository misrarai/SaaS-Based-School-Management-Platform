import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
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
import SaveIcon from "@mui/icons-material/SaveOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  bulkMarkStaffAttendance,
  getStaffAttendanceSummary,
  getStaffDailyRoster,
  type HrAttendanceStatus,
} from "../../../api/hrAttendance";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function StaffAttendancePage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [draft, setDraft] = useState<Record<string, HrAttendanceStatus>>({});

  const rosterQuery = useQuery({
    queryKey: ["staff-attendance-roster", selectedDate],
    queryFn: () => getStaffDailyRoster(selectedDate),
  });
  const summaryQuery = useQuery({
    queryKey: ["staff-attendance-summary", selectedDate],
    queryFn: () => getStaffAttendanceSummary(selectedDate),
  });

  useEffect(() => {
    if (!rosterQuery.data) return;
    const next: Record<string, HrAttendanceStatus> = {};
    for (const entry of rosterQuery.data) {
      next[entry.staff_id] = entry.status ?? "present";
    }
    setDraft(next);
  }, [rosterQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      bulkMarkStaffAttendance({
        attendance_date: selectedDate,
        records: Object.entries(draft).map(([staff_id, status]) => ({ staff_id, status })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance-roster"] });
      queryClient.invalidateQueries({ queryKey: ["staff-attendance-summary"] });
    },
  });

  return (
    <AppShell title="Staff Attendance" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">Staff Attendance</Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button variant="contained" startIcon={<SaveIcon />} onClick={() => save.mutate()} disabled={save.isPending || !rosterQuery.data?.length}>
            Save register
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Present" value={summaryQuery.data?.present ?? "…"} color="success.main" />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Absent" value={summaryQuery.data?.absent ?? "…"} color="error.main" />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Late" value={summaryQuery.data?.late ?? "…"} color="warning.main" />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="On Leave" value={summaryQuery.data?.leave ?? "…"} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Attendance %" value={summaryQuery.data ? `${summaryQuery.data.percentage}%` : "…"} />
        </Grid>
      </Grid>

      {save.isSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Attendance register saved for {selectedDate}.
        </Alert>
      )}
      {rosterQuery.data?.length === 0 && <Alert severity="info">No active staff members to mark.</Alert>}

      {!!rosterQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Staff</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell sx={{ width: 200 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rosterQuery.data.map((entry) => (
                <TableRow key={entry.staff_id} hover>
                  <TableCell>{entry.full_name}</TableCell>
                  <TableCell>{entry.designation}</TableCell>
                  <TableCell>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={draft[entry.staff_id] ?? "present"}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [entry.staff_id]: e.target.value as HrAttendanceStatus }))}
                      >
                        <MenuItem value="present">Present</MenuItem>
                        <MenuItem value="absent">Absent</MenuItem>
                        <MenuItem value="late">Late</MenuItem>
                        <MenuItem value="half_day">Half day</MenuItem>
                        <MenuItem value="leave">Leave</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
