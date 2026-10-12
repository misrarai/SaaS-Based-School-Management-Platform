import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import VideocamIcon from "@mui/icons-material/Videocam";
import LinkIcon from "@mui/icons-material/AddLink";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createOnlineClass,
  deleteSession,
  generateMeetLink,
  listSessions,
  type ClassSession,
  type SessionStatus,
} from "../../../api/schedule";
import { LmsShell, PageHeader, FilterBar, DateField, useAcademics, apiErrorMessage, fmtDate } from "./common";

const STATUS_COLOR: Record<SessionStatus, "default" | "info" | "success" | "error"> = {
  scheduled: "info",
  live: "success",
  completed: "default",
  cancelled: "error",
};

const EMPTY = {
  classId: "",
  sectionId: "",
  subjectId: "",
  teacherId: "",
  session_date: "",
  start_time: "09:00",
  end_time: "10:00",
  title: "",
  description: "",
  notify_channel: "" as "" | "email" | "whatsapp",
};

export function AdminLiveClassesPage() {
  const qc = useQueryClient();
  const academics = useAcademics();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  const sessions = useQuery({
    queryKey: ["lms-sessions", dateFrom, dateTo],
    queryFn: () => listSessions({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["lms-sessions"] });

  const selectedClass = useMemo(
    () => academics.overview.find((c) => c.id === form.classId),
    [academics.overview, form.classId],
  );

  const create = useMutation({
    mutationFn: () =>
      createOnlineClass({
        section_id: form.sectionId,
        subject_id: form.subjectId,
        teacher_id: form.teacherId,
        session_date: form.session_date,
        start_time: form.start_time,
        end_time: form.end_time,
        title: form.title,
        description: form.description || undefined,
        notify_channel: form.notify_channel || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm(EMPTY);
      setNotice({ type: "success", msg: "Online class scheduled." });
      invalidate();
    },
    onError: (e) => setNotice({ type: "error", msg: apiErrorMessage(e, "Could not create the class.") }),
  });

  const genMeet = useMutation({
    mutationFn: (id: string) => generateMeetLink(id, true),
    onSuccess: () => {
      setNotice({ type: "success", msg: "Meeting link generated." });
      invalidate();
    },
    onError: (e) => setNotice({ type: "error", msg: apiErrorMessage(e, "Could not generate a meeting link.") }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: invalidate,
    onError: (e) => setNotice({ type: "error", msg: apiErrorMessage(e, "Could not delete the class.") }),
  });

  const meetingUrl = (s: ClassSession) => s.meeting_url || s.meet_link;
  const canSubmit =
    form.sectionId && form.subjectId && form.teacherId && form.session_date && form.title.trim();

  return (
    <LmsShell title="Live Classes">
      <PageHeader
        title="Live Classes"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setNotice(null); setOpen(true); }}>
            Schedule Online Class
          </Button>
        }
      />

      {notice && (
        <Alert severity={notice.type} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.msg}
        </Alert>
      )}

      <FilterBar>
        <DateField label="From" value={dateFrom} onChange={setDateFrom} />
        <DateField label="To" value={dateTo} onChange={setDateTo} />
        <Typography variant="body2" color="text.secondary">
          {sessions.data?.length ?? 0} classes
        </Typography>
      </FilterBar>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Class · Section</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Teacher</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.isLoading ? (
              <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>
            ) : (sessions.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} sx={{ color: "text.secondary" }}>No online classes in this range.</TableCell></TableRow>
            ) : (
              sessions.data!.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.title || "Class"}</TableCell>
                  <TableCell>{academics.sectionLabel(s.section_id)}</TableCell>
                  <TableCell>{academics.subjectLabel(s.subject_id)}</TableCell>
                  <TableCell>{academics.teacherLabel(s.teacher_id)}</TableCell>
                  <TableCell>{fmtDate(s.session_date)}</TableCell>
                  <TableCell>{s.start_time}–{s.end_time}</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[s.status]} label={s.status} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                      {meetingUrl(s) ? (
                        <Tooltip title="Join / open meeting">
                          <IconButton size="small" color="primary" component="a" href={meetingUrl(s)!} target="_blank" rel="noopener">
                            <VideocamIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Generate Google Meet link">
                          <span>
                            <IconButton size="small" onClick={() => genMeet.mutate(s.id)} disabled={genMeet.isPending}>
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => remove.mutate(s.id)} disabled={remove.isPending}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Schedule Online Class</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select size="small" label="Class" value={form.classId}
              onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, sectionId: "", subjectId: "" }))}
            >
              {academics.overview.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                select size="small" label="Section" value={form.sectionId} fullWidth disabled={!selectedClass}
                onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))}
              >
                {(selectedClass?.sections ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
              <TextField
                select size="small" label="Subject" value={form.subjectId} fullWidth disabled={!selectedClass}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
              >
                {(selectedClass?.subjects ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField
              select size="small" label="Teacher" value={form.teacherId}
              onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
            >
              {academics.teachers.map((t) => <MenuItem key={t.id} value={t.id}>{t.full_name}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField
                size="small" type="date" label="Date" fullWidth slotProps={{ inputLabel: { shrink: true } }}
                value={form.session_date} onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))}
              />
              <TextField
                size="small" type="time" label="Start" slotProps={{ inputLabel: { shrink: true } }}
                value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
              <TextField
                size="small" type="time" label="End" slotProps={{ inputLabel: { shrink: true } }}
                value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              />
            </Stack>
            <TextField
              size="small" label="Description" multiline minRows={2} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <TextField
              select size="small" label="Notify parents/students" value={form.notify_channel}
              onChange={(e) => setForm((f) => ({ ...f, notify_channel: e.target.value as typeof f.notify_channel }))}
            >
              <MenuItem value="">Don't notify</MenuItem>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="whatsapp">WhatsApp</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Scheduling…" : "Schedule"}
          </Button>
        </DialogActions>
      </Dialog>
    </LmsShell>
  );
}
