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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createDiary, deleteDiary, listDiary } from "../../../api/communication";
import { getClassesOverview } from "../../../api/classes";
import { CommunicationShell, PageHeader, errorMessage, fmtDate, todayIso } from "./common";

const EMPTY = { class_grade_id: "", section_id: "", subject_id: "", diary_date: todayIso(), homework: "" };

export function DiaryPage() {
  const qc = useQueryClient();
  const [filterClass, setFilterClass] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const classes = useQuery({ queryKey: ["classes-overview"], queryFn: getClassesOverview });
  const diary = useQuery({
    queryKey: ["comm-diary", filterClass, filterDate],
    queryFn: () => listDiary({ class_grade_id: filterClass || undefined, date: filterDate || undefined }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["comm-diary"] });

  const formClass = useMemo(() => classes.data?.find((c) => c.id === form.class_grade_id), [classes.data, form.class_grade_id]);

  const add = useMutation({
    mutationFn: () => createDiary({
      class_grade_id: form.class_grade_id,
      section_id: form.section_id || null,
      subject_id: form.subject_id || null,
      diary_date: form.diary_date,
      homework: form.homework,
    }),
    onSuccess: () => { setOpen(false); setForm(EMPTY); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not post the diary entry.")),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteDiary(id), onSuccess: invalidate });

  return (
    <CommunicationShell title="Daily Diary">
      <PageHeader
        title="Daily Diary"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setError(null); setOpen(true); }}>New Entry</Button>}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField select size="small" label="Class" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All classes</MenuItem>
          {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="Date" slotProps={{ inputLabel: { shrink: true } }} value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Section</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Homework</TableCell>
              <TableCell>By</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {diary.isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
            ) : (diary.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No diary entries.</TableCell></TableRow>
            ) : (
              diary.data!.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>{fmtDate(d.diary_date)}</TableCell>
                  <TableCell>{d.class_name || "—"}</TableCell>
                  <TableCell>{d.section_name || "All"}</TableCell>
                  <TableCell>{d.subject_name || "—"}</TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>{d.homework}</TableCell>
                  <TableCell>{d.posted_by_name || "—"}</TableCell>
                  <TableCell align="right"><IconButton size="small" color="error" onClick={() => remove.mutate(d.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Diary Entry</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="Class" fullWidth value={form.class_grade_id} onChange={(e) => setForm((f) => ({ ...f, class_grade_id: e.target.value, section_id: "", subject_id: "" }))}>
                {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField size="small" type="date" label="Date" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.diary_date} onChange={(e) => setForm((f) => ({ ...f, diary_date: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="Section" fullWidth value={form.section_id} onChange={(e) => setForm((f) => ({ ...f, section_id: e.target.value }))} disabled={!formClass}>
                <MenuItem value="">All sections</MenuItem>
                {(formClass?.sections ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Subject" fullWidth value={form.subject_id} onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))} disabled={!formClass}>
                <MenuItem value="">—</MenuItem>
                {(formClass?.subjects ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField size="small" label="Homework / notes" multiline minRows={3} value={form.homework} onChange={(e) => setForm((f) => ({ ...f, homework: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!form.class_grade_id || !form.homework.trim() || add.isPending}>Post</Button>
        </DialogActions>
      </Dialog>
    </CommunicationShell>
  );
}
