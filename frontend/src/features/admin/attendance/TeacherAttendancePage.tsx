import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
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
import EditIcon from "@mui/icons-material/EditOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listTeachers } from "../../../api/teachers";
import {
  adminMarkTeacherAttendance,
  getTeacherAttendanceSummary,
  listTeacherAttendance,
  type HrAttendanceStatus,
} from "../../../api/hrAttendance";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_COLORS: Record<HrAttendanceStatus, "success" | "error" | "warning" | "default" | "info"> = {
  present: "success",
  absent: "error",
  late: "warning",
  half_day: "info",
  leave: "default",
};

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

export function TeacherAttendancePage() {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const teachersQuery = useQuery({ queryKey: ["teachers"], queryFn: () => listTeachers() });

  const attendanceQuery = useQuery({
    queryKey: ["teacher-attendance", dateFrom, dateTo],
    queryFn: () => listTeacherAttendance({ dateFrom, dateTo }),
  });
  const summaryQuery = useQuery({
    queryKey: ["teacher-attendance-summary", dateTo],
    queryFn: () => getTeacherAttendanceSummary(dateTo),
  });

  const [markOpen, setMarkOpen] = useState(false);
  const [markTeacherId, setMarkTeacherId] = useState("");
  const [markDate, setMarkDate] = useState(todayIso());
  const [markStatus, setMarkStatus] = useState<HrAttendanceStatus>("absent");
  const [markNote, setMarkNote] = useState("");

  const mark = useMutation({
    mutationFn: () =>
      adminMarkTeacherAttendance({
        teacher_id: markTeacherId,
        attendance_date: markDate,
        status: markStatus,
        note: markNote || undefined,
      }),
    onSuccess: () => {
      setMarkOpen(false);
      setMarkTeacherId("");
      setMarkNote("");
      queryClient.invalidateQueries({ queryKey: ["teacher-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-attendance-summary"] });
    },
  });

  return (
    <AppShell title="Teacher Attendance" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">Teacher Attendance</Typography>
        <Button variant="contained" startIcon={<EditIcon />} onClick={() => setMarkOpen(true)}>
          Mark / Override
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </Paper>

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

      {attendanceQuery.data?.length === 0 && <Alert severity="info">No teacher attendance records for this range yet.</Alert>}

      {!!attendanceQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Teacher</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Check-in</TableCell>
                <TableCell>Check-out</TableCell>
                <TableCell>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attendanceQuery.data.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.attendance_date}</TableCell>
                  <TableCell>{r.teacher_name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status.replace("_", " ")} color={STATUS_COLORS[r.status]} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell>{r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={markOpen} onClose={() => setMarkOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Mark / override teacher attendance</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel id="mark-teacher-label">Teacher</InputLabel>
              <Select labelId="mark-teacher-label" label="Teacher" value={markTeacherId} onChange={(e) => setMarkTeacherId(e.target.value)}>
                {teachersQuery.data?.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.full_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Date"
              type="date"
              value={markDate}
              onChange={(e) => setMarkDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl fullWidth required>
              <InputLabel id="mark-status-label">Status</InputLabel>
              <Select labelId="mark-status-label" label="Status" value={markStatus} onChange={(e) => setMarkStatus(e.target.value as HrAttendanceStatus)}>
                <MenuItem value="present">Present</MenuItem>
                <MenuItem value="absent">Absent</MenuItem>
                <MenuItem value="late">Late</MenuItem>
                <MenuItem value="half_day">Half day</MenuItem>
                <MenuItem value="leave">Leave</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Note (optional)" value={markNote} onChange={(e) => setMarkNote(e.target.value)} fullWidth />
            {mark.isError && <Alert severity="error">Could not save this record.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMarkOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => mark.mutate()} disabled={!markTeacherId || mark.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
