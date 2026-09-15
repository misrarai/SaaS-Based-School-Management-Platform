import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
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
import LoginIcon from "@mui/icons-material/LoginOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  getMyTeacherAttendanceToday,
  listMyTeacherAttendance,
  teacherCheckIn,
  teacherCheckOut,
  type HrAttendanceStatus,
} from "../../../api/hrAttendance";

const STATUS_COLORS: Record<HrAttendanceStatus, "success" | "error" | "warning" | "default" | "info"> = {
  present: "success",
  absent: "error",
  late: "warning",
  half_day: "info",
  leave: "default",
};

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function MyAttendancePage() {
  const queryClient = useQueryClient();
  const todayQuery = useQuery({ queryKey: ["my-teacher-attendance-today"], queryFn: getMyTeacherAttendanceToday });
  const historyQuery = useQuery({
    queryKey: ["my-teacher-attendance-history"],
    queryFn: () => listMyTeacherAttendance(addDaysIso(-30), addDaysIso(0)),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["my-teacher-attendance-today"] });
    queryClient.invalidateQueries({ queryKey: ["my-teacher-attendance-history"] });
  }

  const checkIn = useMutation({ mutationFn: teacherCheckIn, onSuccess: invalidate });
  const checkOut = useMutation({ mutationFn: teacherCheckOut, onSuccess: invalidate });

  const today = todayQuery.data;
  const hasCheckedIn = !!today?.check_in_at;
  const hasCheckedOut = !!today?.check_out_at;

  return (
    <AppShell title="My Attendance" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        My Attendance
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Check in when you arrive and check out when you leave for the day.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={3} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Stack>
            <Typography variant="body2" color="text.secondary">
              Today
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </Typography>
          </Stack>
          <Stack>
            <Typography variant="body2" color="text.secondary">
              Check-in
            </Typography>
            <Typography variant="h6">{today?.check_in_at ? new Date(today.check_in_at).toLocaleTimeString() : "—"}</Typography>
          </Stack>
          <Stack>
            <Typography variant="body2" color="text.secondary">
              Check-out
            </Typography>
            <Typography variant="h6">{today?.check_out_at ? new Date(today.check_out_at).toLocaleTimeString() : "—"}</Typography>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ ml: "auto" }}>
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<LoginIcon />}
              onClick={() => checkIn.mutate()}
              disabled={hasCheckedIn || checkIn.isPending}
            >
              Check In
            </Button>
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<LogoutIcon />}
              onClick={() => checkOut.mutate()}
              disabled={!hasCheckedIn || hasCheckedOut || checkOut.isPending}
            >
              Check Out
            </Button>
          </Stack>
        </Stack>
        {checkIn.isError && <Alert severity="error" sx={{ mt: 2 }}>You've already checked in today.</Alert>}
        {checkOut.isError && <Alert severity="error" sx={{ mt: 2 }}>Check-in first, or you've already checked out.</Alert>}
      </Paper>

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        Last 30 days
      </Typography>
      {historyQuery.data?.length === 0 && <Alert severity="info">No attendance history yet.</Alert>}
      {!!historyQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Check-in</TableCell>
                <TableCell>Check-out</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historyQuery.data.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.attendance_date}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status.replace("_", " ")} color={STATUS_COLORS[r.status]} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell>{r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString() : "—"}</TableCell>
                  <TableCell>{r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
