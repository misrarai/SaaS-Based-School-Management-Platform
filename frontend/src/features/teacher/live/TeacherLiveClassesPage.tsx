import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import LiveTvIcon from "@mui/icons-material/LiveTvOutlined";
import AddIcon from "@mui/icons-material/AddOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrowOutlined";
import StopIcon from "@mui/icons-material/StopOutlined";
import VideoCameraFrontIcon from "@mui/icons-material/VideoCameraFrontOutlined";
import CalendarTodayIcon from "@mui/icons-material/CalendarTodayOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTimeOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  listSessions,
  startSession,
  endSession,
  createOnlineClass,
  deleteSession,
  type ClassSession,
} from "../../../api/schedule";
import { listClasses, listSections, listSubjects } from "../../../api/classes";
import { useAuth } from "../../../auth/AuthContext";

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

function statusChip(s: ClassSession) {
  if (s.status === "active" || s.status === "live") return <Chip size="small" label="🔴 LIVE" color="error" />;
  if (s.status === "completed") return <Chip size="small" label="Done" color="default" />;
  if (s.status === "cancelled") return <Chip size="small" label="Cancelled" color="warning" />;
  return <Chip size="small" label="Scheduled" color="info" />;
}

// ── Schedule Dialog ───────────────────────────────────────────────
function ScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [error, setError] = useState("");

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const sections = useQuery({
    queryKey: ["sections", classId],
    queryFn: () => listSections(classId),
    enabled: !!classId,
  });
  const subjects = useQuery({
    queryKey: ["subjects", classId],
    queryFn: () => listSubjects(classId),
    enabled: !!classId,
  });

  const schedule = useMutation({
    mutationFn: () => {
      if (!sectionId || !subjectId || !title || !date)
        throw new Error("Please fill all required fields");
      return createOnlineClass({
        section_id: sectionId,
        subject_id: subjectId,
        teacher_id: user!.id,
        session_date: date,
        start_time: startTime,
        end_time: endTime,
        title: title.trim(),
        description: meetingUrl ? `Meeting URL: ${meetingUrl}` : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions-teacher"] });
      setTitle(""); setSectionId(""); setSubjectId(""); setClassId(""); setMeetingUrl("");
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.detail || e.message || "Failed"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LiveTvIcon color="primary" />
          <Typography fontWeight={700}>Schedule Live Class</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* Class + Section */}
          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Class *</InputLabel>
              <Select value={classId} label="Class *" onChange={(e) => { setClassId(e.target.value); setSectionId(""); setSubjectId(""); }}>
                {(classes.data ?? []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={!classId}>
              <InputLabel>Section *</InputLabel>
              <Select value={sectionId} label="Section *" onChange={(e) => setSectionId(e.target.value)}>
                {(sections.data ?? []).map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Subject */}
          <FormControl size="small" fullWidth disabled={!classId}>
            <InputLabel>Subject *</InputLabel>
            <Select value={subjectId} label="Subject *" onChange={(e) => setSubjectId(e.target.value)}>
              {(subjects.data ?? []).map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Title */}
          <TextField
            label="Class Title *"
            size="small"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chapter 4 — Algebra Introduction"
          />

          {/* Date & Times */}
          <Stack direction="row" spacing={2}>
            <TextField label="Date *" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
            <TextField label="Start Time" type="time" size="small" fullWidth InputLabelProps={{ shrink: true }} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <TextField label="End Time" type="time" size="small" fullWidth InputLabelProps={{ shrink: true }} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Stack>

          {/* Meeting URL */}
          <TextField
            label="Zoom / Meet Link (optional)"
            size="small"
            fullWidth
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="https://meet.google.com/... or https://zoom.us/j/..."
            helperText="Students will see this link to join the class"
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!title || !classId || !sectionId || !subjectId || schedule.isPending}
          onClick={() => schedule.mutate()}
        >
          Schedule Class
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export function TeacherLiveClassesPage() {
  const qc = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const sessions = useQuery({
    queryKey: ["sessions-teacher"],
    queryFn: () => listSessions({ dateFrom: todayIso(), dateTo: addDaysIso(30) }),
  });

  const start = useMutation({
    mutationFn: (id: string) => startSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions-teacher"] }),
  });
  const end = useMutation({
    mutationFn: (id: string) => endSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions-teacher"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions-teacher"] }),
  });

  const list = sessions.data ?? [];
  const live = list.filter((s) => s.status === "active" || s.status === "live");
  const upcoming = list.filter((s) => s.status === "scheduled");
  const past = list.filter((s) => s.status === "completed" || s.status === "cancelled");

  return (
    <AppShell navItems={teacherNavItems} title="Live Classes">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <LiveTvIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>Live Classes</Typography>
          </Stack>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setScheduleOpen(true)}>
            Schedule Class
          </Button>
        </Stack>

        {/* LIVE NOW */}
        {live.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="error.main" sx={{ mb: 1 }}>🔴 LIVE NOW</Typography>
            <Stack spacing={1.5}>
              {live.map((s) => (
                <Card key={s.id} sx={{ border: "2px solid", borderColor: "error.main", borderRadius: 2 }}>
                  <CardContent>
                    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>{s.title || "Live Class"}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {friendlyDate(s.session_date)} · {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {(s.meeting_url || s.meet_link) && (
                          <Button variant="contained" color="error" startIcon={<VideoCameraFrontIcon />} href={s.meeting_url || s.meet_link || "#"} target="_blank">
                            Join Class
                          </Button>
                        )}
                        <Button variant="outlined" color="error" startIcon={<StopIcon />} onClick={() => end.mutate(s.id)}>
                          End
                        </Button>
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>📅 Upcoming ({upcoming.length})</Typography>
          {upcoming.length === 0 && <Alert severity="info">No upcoming classes. Click "Schedule Class" to add one.</Alert>}
          <Stack spacing={1.5}>
            {upcoming.map((s) => (
              <Card key={s.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>{s.title || "Class"}</Typography>
                      <Stack direction="row" spacing={2}>
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
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={() => start.mutate(s.id)}>
                        Start
                      </Button>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => del.mutate(s.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
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
              {past.slice(0, 5).map((s) => (
                <Box key={s.id} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, opacity: 0.7 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{s.title || "Class"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {friendlyDate(s.session_date)} · {formatTime(s.start_time)}
                      </Typography>
                    </Box>
                    {statusChip(s)}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>

      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </AppShell>
  );
}
