import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { AppShell } from "../../components/AppShell";
import { studentNavItems } from "./studentNav";
import { listSessions, type ClassSession } from "../../api/schedule";
import { getStudentSummary } from "../../api/attendance";
import { getMyStudentProfile } from "../../api/students";
import { listInvoices } from "../../api/fees";
import { getProgress } from "../../api/progress";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function sessionStart(session: ClassSession) {
  return new Date(`${session.session_date}T${session.start_time}`);
}

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "Starting now";
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`, `${seconds}s`);
  return parts.join(" ");
}

export function StudentDashboard() {
  const today = new Date();
  const sessionsQuery = useQuery({
    queryKey: ["schedule-sessions", "student-upcoming"],
    queryFn: () => listSessions({ dateFrom: todayIso(), dateTo: addDaysIso(7) }),
  });
  const profileQuery = useQuery({ queryKey: ["students", "me"], queryFn: getMyStudentProfile });

  const nextSession = useMemo(() => {
    const upcoming = (sessionsQuery.data ?? [])
      .filter((s) => s.status !== "cancelled" && s.status !== "completed")
      .sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime());
    return upcoming[0] ?? null;
  }, [sessionsQuery.data]);

  const countdown = useCountdown(nextSession ? sessionStart(nextSession) : null);

  const summaryQuery = useQuery({
    queryKey: ["attendance-summary", profileQuery.data?.id, today.getMonth() + 1, today.getFullYear()],
    queryFn: () => getStudentSummary(profileQuery.data!.id, today.getMonth() + 1, today.getFullYear()),
    enabled: !!profileQuery.data,
  });

  const invoicesQuery = useQuery({ queryKey: ["fees-invoices", "student"], queryFn: () => listInvoices() });
  const pendingInvoiceCount = (invoicesQuery.data ?? []).filter(
    (inv) => inv.status !== "paid" && inv.status !== "waived",
  ).length;

  const progressQuery = useQuery({
    queryKey: ["progress", profileQuery.data?.id],
    queryFn: () => getProgress(profileQuery.data!.id),
    enabled: !!profileQuery.data,
  });
  const earnedBadges = (progressQuery.data?.badges ?? []).filter((b) => b.achieved);

  return (
    <AppShell title="Student Dashboard" navItems={studentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Welcome back{profileQuery.data ? `, ${profileQuery.data.full_name.split(" ")[0]}` : ""}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Next class
              </Typography>
              {!nextSession && <Typography color="text.secondary">No upcoming classes this week.</Typography>}
              {nextSession && (
                <Stack spacing={1}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {countdown}
                  </Typography>
                  <Typography color="text.secondary">
                    {nextSession.session_date} · {nextSession.start_time.slice(0, 5)} -{" "}
                    {nextSession.end_time.slice(0, 5)}
                  </Typography>
                  <Button
                    variant="contained"
                    disabled={!nextSession.meeting_url}
                    onClick={() => window.open(nextSession.meeting_url!, "_blank", "noopener,noreferrer")}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Join class
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                This month's attendance
              </Typography>
              {summaryQuery.data ? (
                <Stack spacing={1}>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {summaryQuery.data.percentage}%
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                    <Chip size="small" label={`Present: ${summaryQuery.data.present}`} color="success" />
                    <Chip size="small" label={`Absent: ${summaryQuery.data.absent}`} color="error" />
                    <Chip size="small" label={`Late: ${summaryQuery.data.late}`} color="warning" />
                  </Stack>
                </Stack>
              ) : (
                <Typography color="text.secondary">No attendance recorded yet this month.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {progressQuery.data && (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              Progress
            </Typography>
            <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 2, mb: earnedBadges.length ? 2 : 0 }}>
              <Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {progressQuery.data.attendance_percent}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Attendance
                </Typography>
              </Stack>
              <Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {progressQuery.data.assignment_completion_percent}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Homework completed
                </Typography>
              </Stack>
              <Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {progressQuery.data.quiz_average_percent}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Quiz average
                </Typography>
              </Stack>
            </Stack>
            {earnedBadges.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {earnedBadges.map((b) => (
                  <Chip key={b.code} size="small" label={b.label} color="secondary" />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Fee status:
        </Typography>
        {pendingInvoiceCount === 0 ? (
          <Chip size="small" label="All caught up" color="success" />
        ) : (
          <Chip size="small" label={`${pendingInvoiceCount} invoice(s) due`} color="warning" />
        )}
      </Stack>

      {sessionsQuery.data?.length === 0 && (
        <Alert severity="info">Your teacher hasn't scheduled any classes yet.</Alert>
      )}
    </AppShell>
  );
}
