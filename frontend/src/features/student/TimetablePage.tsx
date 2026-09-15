import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
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
import { studentNavItems } from "./studentNav";
import { darkTableHeadSx } from "../../components/tableStyles";
import { listSessions, type ClassSession } from "../../api/schedule";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function canJoin(session: ClassSession, now: Date) {
  if (!session.meeting_url) return false;
  const start = new Date(`${session.session_date}T${session.start_time}`);
  const end = new Date(`${session.session_date}T${session.end_time}`);
  const joinWindowStart = new Date(start.getTime() - 10 * 60 * 1000);
  return now >= joinWindowStart && now <= end;
}

export function TimetablePage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const sessionsQuery = useQuery({
    queryKey: ["schedule-sessions", "student-timetable"],
    queryFn: () => listSessions({ dateFrom: todayIso(), dateTo: addDaysIso(13) }),
  });

  return (
    <AppShell title="My Timetable" navItems={studentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Upcoming classes
      </Typography>

      {sessionsQuery.data?.length === 0 && <Alert severity="info">No classes scheduled yet.</Alert>}

      {!!sessionsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Class</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Join</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessionsQuery.data.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.title ?? "—"}</TableCell>
                  <TableCell>{s.session_date}</TableCell>
                  <TableCell>
                    {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!canJoin(s, now)}
                      onClick={() => window.open(s.meeting_url!, "_blank", "noopener,noreferrer")}
                    >
                      {s.meet_link ? "Join Google Meet" : "Join"}
                    </Button>
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
