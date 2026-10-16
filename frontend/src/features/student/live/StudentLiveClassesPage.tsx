import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import LiveTvIcon from "@mui/icons-material/LiveTvOutlined";
import VideoCameraFrontIcon from "@mui/icons-material/VideoCameraFrontOutlined";
import CalendarTodayIcon from "@mui/icons-material/CalendarTodayOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTimeOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { listSessions, type ClassSession } from "../../../api/schedule";
import { getMyStudentProfile } from "../../../api/students";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function friendlyDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const today = todayIso();
  if (iso === today) return "Today";
  const tomorrow = addDaysIso(1);
  if (iso === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}
function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  const ampm = hr >= 12 ? "PM" : "AM";
  return `${hr % 12 || 12}:${m} ${ampm}`;
}
function isLiveNow(session: ClassSession) {
  const now = new Date();
  const start = new Date(`${session.session_date}T${session.start_time}`);
  const end = new Date(`${session.session_date}T${session.end_time}`);
  return now >= start && now <= end && session.status === "active";
}

export function StudentLiveClassesPage() {
  const profile = useQuery({ queryKey: ["students", "me"], queryFn: getMyStudentProfile });

  const sessions = useQuery({
    queryKey: ["sessions", "student", profile.data?.section_id],
    queryFn: () =>
      listSessions({
        sectionId: profile.data?.section_id ?? undefined,
        dateFrom: todayIso(),
        dateTo: addDaysIso(14),
      }),
    enabled: !!profile.data?.section_id,
  });

  const list = sessions.data ?? [];
  const live = list.filter(isLiveNow);
  const upcoming = list.filter((s) => !isLiveNow(s));

  return (
    <AppShell navItems={studentNavItems} title="Live Classes">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <LiveTvIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Live Classes
          </Typography>
        </Stack>

        {!profile.data?.section_id && !profile.isLoading && (
          <Alert severity="info">
            You are not assigned to a class section yet. Please contact your teacher or admin.
          </Alert>
        )}

        {/* LIVE NOW */}
        {live.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="error.main" sx={{ mb: 1 }}>
              🔴 LIVE NOW
            </Typography>
            <Stack spacing={2}>
              {live.map((s) => (
                <Card key={s.id} sx={{ border: "2px solid", borderColor: "error.main", borderRadius: 2 }}>
                  <CardContent>
                    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2}>
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <Chip size="small" label="LIVE" color="error" />
                          <Typography variant="h6" fontWeight={700}>
                            {s.title || "Live Class"}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={2}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <AccessTimeIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {formatTime(s.start_time)} – {formatTime(s.end_time)}
                            </Typography>
                          </Stack>
                        </Stack>
                        {s.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {s.description}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        variant="contained"
                        color="error"
                        size="large"
                        startIcon={<VideoCameraFrontIcon />}
                        href={s.meeting_url || s.meet_link || "#"}
                        target="_blank"
                        disabled={!s.meeting_url && !s.meet_link}
                        sx={{ minWidth: 140, fontWeight: 700 }}
                      >
                        Join Now
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* UPCOMING */}
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            📅 Upcoming Classes (Next 14 days)
          </Typography>

          {upcoming.length === 0 && !sessions.isLoading && (
            <Alert severity="info">No upcoming live classes scheduled yet.</Alert>
          )}

          <Stack spacing={1.5}>
            {upcoming.map((s) => (
              <Card key={s.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {s.title || "Class Session"}
                      </Typography>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.25 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <CalendarTodayIcon fontSize="small" sx={{ fontSize: 14 }} color="action" />
                          <Typography variant="caption" color="text.secondary">
                            {friendlyDate(s.session_date)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <AccessTimeIcon fontSize="small" sx={{ fontSize: 14 }} color="action" />
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(s.start_time)} – {formatTime(s.end_time)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                    {(s.meeting_url || s.meet_link) && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VideoCameraFrontIcon />}
                        href={s.meeting_url || s.meet_link || "#"}
                        target="_blank"
                      >
                        Join Link
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      </Stack>
    </AppShell>
  );
}
