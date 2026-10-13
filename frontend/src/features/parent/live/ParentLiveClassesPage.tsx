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
import CalendarTodayIcon from "@mui/icons-material/CalendarTodayOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTimeOutlined";
import VideoCameraFrontIcon from "@mui/icons-material/VideoCameraFrontOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { listSessions, type ClassSession } from "../../../api/schedule";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function friendlyDate(iso: string) {
  if (iso === todayIso()) return "Today";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}

function isLiveNow(s: ClassSession) {
  if (s.status !== "active" && s.status !== "live") return false;
  const now = new Date();
  const start = new Date(`${s.session_date}T${s.start_time}`);
  const end = new Date(`${s.session_date}T${s.end_time}`);
  return now >= start && now <= end;
}

export function ParentLiveClassesPage() {
  const sessions = useQuery({
    queryKey: ["sessions-parent"],
    queryFn: () => listSessions({ dateFrom: todayIso(), dateTo: addDaysIso(30) }),
  });

  const list = sessions.data ?? [];
  const live = list.filter(isLiveNow);
  const upcoming = list.filter((s) => s.status === "scheduled");
  const past = list.filter((s) => s.status === "completed" || s.status === "cancelled");

  return (
    <AppShell navItems={parentNavItems} title="Live Classes">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <LiveTvIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Live Classes</Typography>
            <Typography variant="body2" color="text.secondary">
              Monitor your child's live class schedule
            </Typography>
          </Box>
        </Stack>

        {/* LIVE NOW */}
        {live.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="error.main" sx={{ mb: 1 }}>
              🔴 LIVE NOW
            </Typography>
            <Stack spacing={1.5}>
              {live.map((s) => (
                <Card key={s.id} sx={{ border: "2px solid", borderColor: "error.main", borderRadius: 2 }}>
                  <CardContent>
                    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>{s.title || "Live Class"}</Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <CalendarTodayIcon sx={{ fontSize: 13 }} color="action" />
                            <Typography variant="caption" color="text.secondary">{friendlyDate(s.session_date)}</Typography>
                          </Stack>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <AccessTimeIcon sx={{ fontSize: 13 }} color="action" />
                            <Typography variant="caption" color="text.secondary">{formatTime(s.start_time)} – {formatTime(s.end_time)}</Typography>
                          </Stack>
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label="🔴 LIVE" color="error" />
                        {(s.meeting_url || s.meet_link) && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<VideoCameraFrontIcon />}
                            href={s.meeting_url || s.meet_link || "#"}
                            target="_blank"
                          >
                            Watch Link
                          </Button>
                        )}
                      </Stack>
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
            📅 Upcoming Classes ({upcoming.length})
          </Typography>
          {upcoming.length === 0 && (
            <Alert severity="info">No upcoming classes scheduled in the next 30 days.</Alert>
          )}
          <Stack spacing={1.5}>
            {upcoming.map((s) => (
              <Card key={s.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>{s.title || "Class"}</Typography>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <CalendarTodayIcon sx={{ fontSize: 13 }} color="action" />
                          <Typography variant="caption" color="text.secondary">{friendlyDate(s.session_date)}</Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <AccessTimeIcon sx={{ fontSize: 13 }} color="action" />
                          <Typography variant="caption" color="text.secondary">{formatTime(s.start_time)} – {formatTime(s.end_time)}</Typography>
                        </Stack>
                      </Stack>
                    </Box>
                    <Chip size="small" label="Scheduled" color="info" variant="outlined" />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>

        {/* PAST */}
        {past.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
              ✅ Past Classes ({past.length})
            </Typography>
            <Stack spacing={1}>
              {past.slice(0, 10).map((s) => (
                <Box key={s.id} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, opacity: 0.7 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{s.title || "Class"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {friendlyDate(s.session_date)} · {formatTime(s.start_time)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={s.status === "completed" ? "Done" : "Cancelled"}
                      color={s.status === "completed" ? "success" : "warning"}
                      variant="outlined"
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </AppShell>
  );
}
