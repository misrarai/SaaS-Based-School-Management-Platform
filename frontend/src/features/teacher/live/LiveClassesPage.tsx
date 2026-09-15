import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  IconButton,
  Paper,
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { endSession, listSessions, startSession, type ClassSession } from "../../../api/schedule";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function statusColor(status: ClassSession["status"]): "success" | "default" | "error" | "info" {
  switch (status) {
    case "live":
      return "success";
    case "completed":
      return "default";
    case "cancelled":
      return "error";
    default:
      return "info";
  }
}

export function LiveClassesPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());

  const sessionsQuery = useQuery({
    queryKey: ["schedule-sessions", "teacher-live-classes", date],
    queryFn: () => listSessions({ dateFrom: date, dateTo: date }),
  });

  const start = useMutation({
    mutationFn: (sessionId: string) => startSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedule-sessions"] }),
  });
  const end = useMutation({
    mutationFn: (sessionId: string) => endSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedule-sessions"] }),
  });

  function handleJoin(session: ClassSession) {
    if (session.status === "scheduled") start.mutate(session.id);
    if (session.meeting_url) window.open(session.meeting_url, "_blank", "noopener,noreferrer");
  }

  const sessions = useMemo(
    () => [...(sessionsQuery.data ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [sessionsQuery.data],
  );

  return (
    <AppShell title="Live Classes" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Live Classes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Start, join and end your scheduled sessions for any day.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 3 }}>
        <IconButton onClick={() => setDate((d) => shiftDate(d, -1))} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <TextField
          type="date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          sx={{ minWidth: 170 }}
        />
        <IconButton onClick={() => setDate((d) => shiftDate(d, 1))} size="small">
          <ChevronRightIcon />
        </IconButton>
        <Button size="small" startIcon={<TodayIcon />} onClick={() => setDate(todayIso())} disabled={date === todayIso()}>
          Today
        </Button>
      </Stack>

      {sessionsQuery.isLoading && <Typography>Loading…</Typography>}
      {sessions.length === 0 && !sessionsQuery.isLoading && (
        <Alert severity="info">No classes scheduled for {date}.</Alert>
      )}

      {sessions.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={s.status}
                      color={statusColor(s.status)}
                      sx={{ textTransform: "capitalize" }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      {(s.status === "scheduled" || s.status === "live") && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleJoin(s)}
                          disabled={!s.meeting_url}
                        >
                          {s.status === "scheduled" ? "Start & Join" : "Join"}
                        </Button>
                      )}
                      {s.status === "live" && (
                        <Button size="small" color="error" onClick={() => end.mutate(s.id)} disabled={end.isPending}>
                          End class
                        </Button>
                      )}
                    </Stack>
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
