import { useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Grid,
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
import ClassIcon from "@mui/icons-material/ClassOutlined";
import GroupIcon from "@mui/icons-material/GroupOutlined";
import EventIcon from "@mui/icons-material/EventOutlined";
import { AppShell } from "../../components/AppShell";
import { teacherNavItems } from "./teacherNav";
import { darkTableHeadSx } from "../../components/tableStyles";
import { endSession, listSessions, startSession, type ClassSession } from "../../api/schedule";
import { listCourses, listMyStudents } from "../../api/courses";
import { useAuth } from "../../auth/AuthContext";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function StatCard({ icon, label, value, to, color }: { icon: ReactNode; label: string; value: number | string; to: string; color: string }) {
  return (
    <Card variant="outlined">
      <CardActionArea component={RouterLink} to={to} sx={{ p: 2 }}>
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
      </CardActionArea>
    </Card>
  );
}

export function TeacherDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = todayIso();

  const coursesQuery = useQuery({ queryKey: ["courses", "mine"], queryFn: () => listCourses() });
  const studentsQuery = useQuery({ queryKey: ["courses", "students", "mine"], queryFn: listMyStudents });
  const sessionsQuery = useQuery({
    queryKey: ["schedule-sessions", "teacher-today", today],
    queryFn: () => listSessions({ dateFrom: today, dateTo: today }),
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
    <AppShell title="Teacher Dashboard" navItems={teacherNavItems}>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.full_name?.split(" ")[0]}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard icon={<ClassIcon />} label="My Classes" value={coursesQuery.data?.length ?? "…"} to="/teacher/classes" color="primary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard icon={<GroupIcon />} label="My Students" value={studentsQuery.data?.length ?? "…"} to="/teacher/students" color="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard icon={<EventIcon />} label="Today's Sessions" value={sessions.length} to="/teacher/live-classes" color="info" />
        </Grid>
      </Grid>

      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6">Today's classes</Typography>
        <Button size="small" component={RouterLink} to="/teacher/live-classes">
          View all live classes
        </Button>
      </Stack>

      {sessionsQuery.isLoading && <Typography>Loading…</Typography>}
      {sessions.length === 0 && !sessionsQuery.isLoading && (
        <Alert severity="info">No classes scheduled for you today.</Alert>
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
