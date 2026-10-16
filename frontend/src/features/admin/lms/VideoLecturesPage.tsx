import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
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
import PlayCircleIcon from "@mui/icons-material/PlayArrow";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createResource, deleteResource, listResources } from "../../../api/resources";
import { LmsShell, PageHeader, FilterBar, useAcademics, apiErrorMessage } from "./common";

const EMPTY = { classId: "", subjectId: "", title: "", description: "", external_url: "", category: "" };

export function VideoLecturesPage() {
  const qc = useQueryClient();
  const academics = useAcademics();
  const [classFilter, setClassFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  const lectures = useQuery({
    queryKey: ["lms-lectures", classFilter],
    queryFn: () => listResources({ resourceType: "video", classGradeId: classFilter || undefined }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["lms-lectures"] });

  const selectedClass = useMemo(
    () => academics.overview.find((c) => c.id === form.classId),
    [academics.overview, form.classId],
  );

  const create = useMutation({
    mutationFn: () =>
      createResource({
        title: form.title,
        description: form.description || undefined,
        resource_type: "video",
        external_url: form.external_url,
        class_grade_id: form.classId || undefined,
        subject_id: form.subjectId || undefined,
        category: form.category || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm(EMPTY);
      setNotice({ type: "success", msg: "Video lecture added." });
      invalidate();
    },
    onError: (e) => setNotice({ type: "error", msg: apiErrorMessage(e, "Could not add the lecture.") }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: invalidate,
    onError: (e) => setNotice({ type: "error", msg: apiErrorMessage(e, "Could not delete the lecture.") }),
  });

  const className = (id: string | null) => (id ? academics.overview.find((c) => c.id === id)?.name ?? "—" : "—");
  const canSubmit = form.title.trim() && form.external_url.trim();

  return (
    <LmsShell title="Video Lectures">
      <PageHeader
        title="Video Lectures"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setNotice(null); setOpen(true); }}>
            Add Lecture
          </Button>
        }
      />

      {notice && (
        <Alert severity={notice.type} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.msg}
        </Alert>
      )}

      <FilterBar>
        <TextField
          select size="small" label="Class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All classes</MenuItem>
          {academics.overview.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <Typography variant="body2" color="text.secondary">{lectures.data?.length ?? 0} lectures</Typography>
      </FilterBar>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Topic / Category</TableCell>
              <TableCell>Video</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lectures.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : (lectures.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No video lectures yet.</TableCell></TableRow>
            ) : (
              lectures.data!.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    {r.title}
                    {r.description && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{r.description}</Typography>}
                  </TableCell>
                  <TableCell>{className(r.class_grade_id)}</TableCell>
                  <TableCell>{r.subject_id ? academics.subjectLabel(r.subject_id) : "—"}</TableCell>
                  <TableCell>{r.category || "—"}</TableCell>
                  <TableCell>
                    {r.external_url ? (
                      <Link href={r.external_url} target="_blank" rel="noopener" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        <PlayCircleIcon fontSize="small" /> Watch
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Video Lecture</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField size="small" label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <TextField
              size="small" label="Video URL (YouTube, Vimeo, …)" placeholder="https://youtu.be/…"
              value={form.external_url} onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select size="small" label="Class" value={form.classId} fullWidth
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, subjectId: "" }))}
              >
                <MenuItem value="">—</MenuItem>
                {academics.overview.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField
                select size="small" label="Subject" value={form.subjectId} fullWidth disabled={!selectedClass}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
              >
                <MenuItem value="">—</MenuItem>
                {(selectedClass?.subjects ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField size="small" label="Topic / Category" placeholder="e.g. Algebra · Chapter 3" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            <TextField size="small" label="Description" multiline minRows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Saving…" : "Add Lecture"}
          </Button>
        </DialogActions>
      </Dialog>
    </LmsShell>
  );
}
