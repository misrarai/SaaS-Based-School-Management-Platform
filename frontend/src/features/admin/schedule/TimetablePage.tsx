import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
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
import AddIcon from "@mui/icons-material/Add";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses, listSections, listSubjects } from "../../../api/classes";
import { listTeachers } from "../../../api/teachers";
import {
  createOnlineClass,
  createTemplate,
  generateSessions,
  listSessions,
  listTemplates,
  type ClassSession,
} from "../../../api/schedule";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
} from "../../../api/googleCalendar";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MEETING_STATUS_LABELS: Record<ClassSession["meeting_status"], string> = {
  not_created: "No Meet link",
  created: "Google Meet ready",
  failed: "Google Meet could not be created",
  cancelled: "Cancelled",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function TimetablePage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const teachersQuery = useQuery({ queryKey: ["teachers"], queryFn: () => listTeachers() });
  const templatesQuery = useQuery({ queryKey: ["schedule-templates"], queryFn: listTemplates });
  const sessionsQuery = useQuery({ queryKey: ["schedule-sessions"], queryFn: () => listSessions() });
  const googleStatusQuery = useQuery({ queryKey: ["google-calendar-status"], queryFn: getGoogleCalendarStatus });

  const googleResult = searchParams.get("google");
  useEffect(() => {
    if (!googleResult) return;
    queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
  }, [googleResult, queryClient]);

  const connectGoogle = useMutation({ mutationFn: connectGoogleCalendar });
  const disconnectGoogle = useMutation({
    mutationFn: disconnectGoogleCalendar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] }),
  });

  const classIds = useMemo(() => classesQuery.data?.map((c) => c.id) ?? [], [classesQuery.data]);
  const sectionQueries = useQueries({
    queries: classIds.map((id) => ({ queryKey: ["sections", id], queryFn: () => listSections(id) })),
  });
  const subjectQueries = useQueries({
    queries: classIds.map((id) => ({ queryKey: ["subjects", id], queryFn: () => listSubjects(id) })),
  });

  const sectionNameById = useMemo(() => {
    const map: Record<string, string> = {};
    sectionQueries.forEach((q, i) => {
      const className = classesQuery.data?.[i]?.name;
      q.data?.forEach((s) => {
        map[s.id] = className ? `${className} - ${s.name}` : s.name;
      });
    });
    return map;
  }, [sectionQueries, classesQuery.data]);

  const subjectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    subjectQueries.forEach((q) => {
      q.data?.forEach((s) => {
        map[s.id] = s.name;
      });
    });
    return map;
  }, [subjectQueries]);

  const teacherNameById = useMemo(() => {
    const map: Record<string, string> = {};
    teachersQuery.data?.forEach((t) => {
      map[t.id] = t.full_name;
    });
    return map;
  }, [teachersQuery.data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:45");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const sectionsForSelectedClass = useQuery({
    queryKey: ["sections", selectedClassId],
    queryFn: () => listSections(selectedClassId),
    enabled: !!selectedClassId,
  });
  const subjectsForSelectedClass = useQuery({
    queryKey: ["subjects", selectedClassId],
    queryFn: () => listSubjects(selectedClassId),
    enabled: !!selectedClassId,
  });

  const addTemplate = useMutation({
    mutationFn: () =>
      createTemplate({
        section_id: sectionId,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: Number(dayOfWeek),
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        default_meeting_url: meetingUrl || undefined,
      }),
    onSuccess: () => {
      setDialogOpen(false);
      setSelectedClassId("");
      setSectionId("");
      setSubjectId("");
      setTeacherId("");
      setMeetingUrl("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["schedule-templates"] });
    },
    onError: () => setFormError("Could not create the schedule slot — check the times and try again."),
  });

  const [rangeStart, setRangeStart] = useState(todayIso());
  const [rangeEnd, setRangeEnd] = useState(() => addDaysIso(13));
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => generateSessions(rangeStart, rangeEnd),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["schedule-sessions"] });
      setGenerateMessage(`Generated ${created.length} new session(s) for this range.`);
    },
  });

  // --- Create Online Class (Google Meet) ---
  const [onlineDialogOpen, setOnlineDialogOpen] = useState(false);
  const [ocClassId, setOcClassId] = useState("");
  const [ocSectionId, setOcSectionId] = useState("");
  const [ocSubjectId, setOcSubjectId] = useState("");
  const [ocTeacherId, setOcTeacherId] = useState("");
  const [ocDate, setOcDate] = useState(todayIso());
  const [ocStartTime, setOcStartTime] = useState("10:00");
  const [ocEndTime, setOcEndTime] = useState("11:00");
  const [ocTitle, setOcTitle] = useState("");
  const [ocDescription, setOcDescription] = useState("");
  const [ocNotify, setOcNotify] = useState<"" | "email" | "whatsapp">("");
  const [createdClass, setCreatedClass] = useState<ClassSession | null>(null);

  // Sidebar's "Online Classes" link (/admin/schedule?create=online) opens this dialog directly.
  useEffect(() => {
    if (searchParams.get("create") === "online") {
      setOnlineDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ocSections = useQuery({
    queryKey: ["sections", ocClassId],
    queryFn: () => listSections(ocClassId),
    enabled: !!ocClassId,
  });
  const ocSubjects = useQuery({
    queryKey: ["subjects", ocClassId],
    queryFn: () => listSubjects(ocClassId),
    enabled: !!ocClassId,
  });

  function resetOnlineClassForm() {
    setOcClassId("");
    setOcSectionId("");
    setOcSubjectId("");
    setOcTeacherId("");
    setOcTitle("");
    setOcDescription("");
    setOcNotify("");
    setCreatedClass(null);
  }

  const createOnline = useMutation({
    mutationFn: () =>
      createOnlineClass({
        section_id: ocSectionId,
        subject_id: ocSubjectId,
        teacher_id: ocTeacherId,
        session_date: ocDate,
        start_time: `${ocStartTime}:00`,
        end_time: `${ocEndTime}:00`,
        title: ocTitle,
        description: ocDescription || undefined,
        notify_channel: ocNotify || undefined,
      }),
    onSuccess: (created) => {
      setCreatedClass(created);
      queryClient.invalidateQueries({ queryKey: ["schedule-sessions"] });
    },
  });

  return (
    <AppShell title="Timetable" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Weekly Schedule</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="success"
            startIcon={<VideoCallIcon />}
            onClick={() => setOnlineDialogOpen(true)}
          >
            Create Online Class
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Add weekly slot
          </Button>
        </Stack>
      </Stack>

      {googleResult && (
        <Alert
          severity={googleResult === "connected" ? "success" : "error"}
          sx={{ mb: 3 }}
          onClose={() => setSearchParams({}, { replace: true })}
        >
          {googleResult === "connected" && "Google Calendar connected — online classes will now get a Google Meet link automatically."}
          {googleResult === "denied" && "Google Calendar connection was cancelled."}
          {googleResult === "error" && "Could not connect Google Calendar. Please try again."}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Google Calendar
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {googleStatusQuery.data?.connected
                ? `Connected as ${googleStatusQuery.data.google_account_email ?? "your Google account"}`
                : "Connect a Google account so online classes automatically get a Google Meet link."}
            </Typography>
          </Box>
          {googleStatusQuery.data?.connected ? (
            <Button color="error" variant="outlined" onClick={() => disconnectGoogle.mutate()} disabled={disconnectGoogle.isPending}>
              Disconnect
            </Button>
          ) : (
            <Button variant="contained" onClick={() => connectGoogle.mutate()} disabled={connectGoogle.isPending}>
              Connect Google Calendar
            </Button>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Weekly slots
        </Typography>
        {templatesQuery.data?.length === 0 && (
          <Alert severity="info">No recurring slots yet — click "Add weekly slot" to schedule your first class.</Alert>
        )}
        {!!templatesQuery.data?.length && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Section</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Day</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Meeting link</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templatesQuery.data.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>{sectionNameById[t.section_id] ?? "—"}</TableCell>
                    <TableCell>{subjectNameById[t.subject_id] ?? "—"}</TableCell>
                    <TableCell>{teacherNameById[t.teacher_id] ?? "—"}</TableCell>
                    <TableCell>{DAY_LABELS[t.day_of_week]}</TableCell>
                    <TableCell>
                      {t.start_time.slice(0, 5)} - {t.end_time.slice(0, 5)}
                    </TableCell>
                    <TableCell>{t.default_meeting_url ?? "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t.is_active ? "Active" : "Inactive"}
                        color={t.is_active ? "success" : "default"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Generate dated sessions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Turns the weekly slots above into actual scheduled classes for a date range. Safe to run repeatedly —
          it skips dates that already have a session.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button variant="contained" color="success" onClick={() => generate.mutate()} disabled={generate.isPending}>
            Generate sessions
          </Button>
        </Stack>
        {generateMessage && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {generateMessage}
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Upcoming & recent sessions
        </Typography>
        {sessionsQuery.data?.length === 0 && <Alert severity="info">No sessions generated yet.</Alert>}
        {!!sessionsQuery.data?.length && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Title / Section</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Google Meet</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessionsQuery.data.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>{s.session_date}</TableCell>
                    <TableCell>{s.title ?? sectionNameById[s.section_id] ?? "—"}</TableCell>
                    <TableCell>{subjectNameById[s.subject_id] ?? "—"}</TableCell>
                    <TableCell>{teacherNameById[s.teacher_id] ?? "—"}</TableCell>
                    <TableCell>
                      {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={s.status} />
                    </TableCell>
                    <TableCell>
                      {s.meet_link ? (
                        <Button
                          size="small"
                          href={s.meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<VideoCallIcon />}
                        >
                          Join
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {MEETING_STATUS_LABELS[s.meeting_status]}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add a weekly slot</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            addTemplate.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <FormControl fullWidth required>
                <InputLabel id="class-label">Class</InputLabel>
                <Select
                  labelId="class-label"
                  label="Class"
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSectionId("");
                    setSubjectId("");
                  }}
                >
                  {classesQuery.data?.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth required disabled={!selectedClassId}>
                  <InputLabel id="section-label">Section</InputLabel>
                  <Select
                    labelId="section-label"
                    label="Section"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                  >
                    {sectionsForSelectedClass.data?.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth required disabled={!selectedClassId}>
                  <InputLabel id="subject-label">Subject</InputLabel>
                  <Select
                    labelId="subject-label"
                    label="Subject"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    {subjectsForSelectedClass.data?.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <FormControl fullWidth required>
                <InputLabel id="teacher-label">Teacher</InputLabel>
                <Select
                  labelId="teacher-label"
                  label="Teacher"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                >
                  {teachersQuery.data?.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.full_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel id="day-label">Day of week</InputLabel>
                <Select
                  labelId="day-label"
                  label="Day of week"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                >
                  {DAY_LABELS.map((label, i) => (
                    <MenuItem key={label} value={String(i)}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Start time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="End time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
              <TextField
                label="Default meeting link (optional)"
                placeholder="https://meet.google.com/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                fullWidth
              />
              {formError && <Alert severity="error">{formError}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addTemplate.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={onlineDialogOpen}
        onClose={() => {
          setOnlineDialogOpen(false);
          resetOnlineClassForm();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create Online Class</DialogTitle>
        {createdClass ? (
          <>
            <DialogContent>
              <Alert severity="success" sx={{ mb: 2 }}>
                Online class created successfully.
              </Alert>
              {createdClass.meet_link ? (
                <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
                  <Typography variant="body2" color="text.secondary">
                    Google Meet:
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    {createdClass.meet_link}
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<VideoCallIcon />}
                    href={createdClass.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join Google Meet
                  </Button>
                </Stack>
              ) : (
                <Alert severity="warning">
                  Google Meet could not be created{!googleStatusQuery.data?.connected && " — connect Google Calendar above and retry from the sessions table"}.
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  setOnlineDialogOpen(false);
                  resetOnlineClassForm();
                }}
              >
                Done
              </Button>
            </DialogActions>
          </>
        ) : (
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              createOnline.mutate();
            }}
          >
            <DialogContent>
              <Stack spacing={2}>
                <TextField
                  label="Title"
                  placeholder="Mathematics Online Class"
                  value={ocTitle}
                  onChange={(e) => setOcTitle(e.target.value)}
                  required
                  fullWidth
                />
                <FormControl fullWidth required>
                  <InputLabel id="oc-class-label">Class</InputLabel>
                  <Select
                    labelId="oc-class-label"
                    label="Class"
                    value={ocClassId}
                    onChange={(e) => {
                      setOcClassId(e.target.value);
                      setOcSectionId("");
                      setOcSubjectId("");
                    }}
                  >
                    {classesQuery.data?.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Stack direction="row" spacing={2}>
                  <FormControl fullWidth required disabled={!ocClassId}>
                    <InputLabel id="oc-section-label">Section</InputLabel>
                    <Select labelId="oc-section-label" label="Section" value={ocSectionId} onChange={(e) => setOcSectionId(e.target.value)}>
                      {ocSections.data?.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth required disabled={!ocClassId}>
                    <InputLabel id="oc-subject-label">Subject</InputLabel>
                    <Select labelId="oc-subject-label" label="Subject" value={ocSubjectId} onChange={(e) => setOcSubjectId(e.target.value)}>
                      {ocSubjects.data?.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
                <FormControl fullWidth required>
                  <InputLabel id="oc-teacher-label">Teacher</InputLabel>
                  <Select labelId="oc-teacher-label" label="Teacher" value={ocTeacherId} onChange={(e) => setOcTeacherId(e.target.value)}>
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
                  value={ocDate}
                  onChange={(e) => setOcDate(e.target.value)}
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Start time"
                    type="time"
                    value={ocStartTime}
                    onChange={(e) => setOcStartTime(e.target.value)}
                    required
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="End time"
                    type="time"
                    value={ocEndTime}
                    onChange={(e) => setOcEndTime(e.target.value)}
                    required
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
                <TextField
                  label="Description"
                  multiline
                  minRows={2}
                  value={ocDescription}
                  onChange={(e) => setOcDescription(e.target.value)}
                  fullWidth
                />
                <FormControl>
                  <FormLabel sx={{ fontSize: 14 }}>Notify the class (optional)</FormLabel>
                  <RadioGroup row value={ocNotify} onChange={(e) => setOcNotify(e.target.value as typeof ocNotify)}>
                    <FormControlLabel value="" control={<Radio size="small" />} label="Don't notify" />
                    <FormControlLabel value="email" control={<Radio size="small" />} label="Email" />
                    <FormControlLabel value="whatsapp" control={<Radio size="small" />} label="WhatsApp" />
                  </RadioGroup>
                </FormControl>
                {createOnline.isError && <Alert severity="error">Could not create the online class — check the details and try again.</Alert>}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                onClick={() => {
                  setOnlineDialogOpen(false);
                  resetOnlineClassForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={createOnline.isPending}>
                Create Online Class
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>
    </AppShell>
  );
}
