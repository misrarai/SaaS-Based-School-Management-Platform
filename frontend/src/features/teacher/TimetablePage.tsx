import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AppShell } from "../../components/AppShell";
import { teacherNavItems } from "./teacherNav";
import { darkTableHeadSx } from "../../components/tableStyles";
import { listSessions } from "../../api/schedule";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function TimetablePage() {
  const sessionsQuery = useQuery({
    queryKey: ["schedule-sessions", "teacher-timetable"],
    queryFn: () => listSessions({ dateFrom: todayIso(), dateTo: addDaysIso(13) }),
  });

  return (
    <AppShell title="My Timetable" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Upcoming classes (next 14 days)
      </Typography>

      {sessionsQuery.data?.length === 0 && <Alert severity="info">No upcoming classes scheduled.</Alert>}

      {!!sessionsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessionsQuery.data.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.session_date}</TableCell>
                  <TableCell>
                    {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status} sx={{ textTransform: "capitalize" }} />
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
