import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Autocomplete, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BookIcon from "@mui/icons-material/MenuBookOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  addRecord, createEnrolment, listEnrolments, listHalqas, listRecords, updateEnrolment,
  type Enrolment, type EnrolmentStatus, type HifzGrade,
} from "../../../api/hifz";
import { listStudents, type Student } from "../../../api/students";

const GRADE_COLOR: Record<HifzGrade, "success" | "primary" | "warning" | "error"> = {
  excellent: "success", good: "primary", fair: "warning", weak: "error",
};
const STATUS_COLOR: Record<EnrolmentStatus, "success" | "default" | "warning"> = { active: "success", completed: "default", left: "warning" };

function RecordsDialog({ enrolment, onClose }: { enrolment: Enrolment; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ sabaq: "", sabqi: "", manzil: "", grade: "good" as HifzGrade, mistakes: "", remarks: "" });
  const records = useQuery({ queryKey: ["hifz-records", enrolment.id], queryFn: () => listRecords(enrolment.id) });
  const add = useMutation({
    mutationFn: () => addRecord(enrolment.id, {
      sabaq: form.sabaq || null, sabqi: form.sabqi || null, manzil: form.manzil || null,
      grade: form.grade, mistakes: form.mistakes ? Number(form.mistakes) : null, remarks: form.remarks || null,
    }),
    onSuccess: () => { setForm({ sabaq: "", sabqi: "", manzil: "", grade: "good", mistakes: "", remarks: "" }); qc.invalidateQueries({ queryKey: ["hifz-records", enrolment.id] }); qc.invalidateQueries({ queryKey: ["hifz-enrolments"] }); },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Daily records — {enrolment.student_name} (Juz {enrolment.current_juz})</DialogTitle>
      <DialogContent>
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Add today's entry</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <TextField size="small" label="Sabaq (new)" value={form.sabaq} onChange={(e) => setForm((f) => ({ ...f, sabaq: e.target.value }))} />
            <TextField size="small" label="Sabqi (recent)" value={form.sabqi} onChange={(e) => setForm((f) => ({ ...f, sabqi: e.target.value }))} />
            <TextField size="small" label="Manzil (old)" value={form.manzil} onChange={(e) => setForm((f) => ({ ...f, manzil: e.target.value }))} />
            <TextField select size="small" label="Grade" value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value as HifzGrade }))} sx={{ minWidth: 120 }}>
              {(["excellent", "good", "fair", "weak"] as HifzGrade[]).map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
            </TextField>
            <TextField size="small" type="number" label="Mistakes" value={form.mistakes} onChange={(e) => setForm((f) => ({ ...f, mistakes: e.target.value }))} sx={{ width: 100 }} />
            <Button variant="contained" onClick={() => add.mutate()} disabled={add.isPending}>Save</Button>
          </Stack>
        </Paper>
        <TableContainer>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}><TableRow>
              <TableCell>Date</TableCell><TableCell>Sabaq</TableCell><TableCell>Sabqi</TableCell><TableCell>Manzil</TableCell><TableCell>Grade</TableCell><TableCell align="right">Mistakes</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(records.data?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No records yet.</TableCell></TableRow>
              ) : records.data!.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.record_date}</TableCell><TableCell>{r.sabaq || "—"}</TableCell><TableCell>{r.sabqi || "—"}</TableCell><TableCell>{r.manzil || "—"}</TableCell>
                  <TableCell>{r.grade ? <Chip size="small" color={GRADE_COLOR[r.grade]} label={r.grade} /> : "—"}</TableCell>
                  <TableCell align="right">{r.mistakes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

export function EnrolmentsPage() {
  const qc = useQueryClient();
  const [halqaFilter, setHalqaFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [halqaId, setHalqaId] = useState("");
  const [juz, setJuz] = useState("1");
  const [page, setPage] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<Enrolment | null>(null);

  const halqas = useQuery({ queryKey: ["hifz-halqas"], queryFn: listHalqas });
  const students = useQuery({ queryKey: ["students-active"], queryFn: () => listStudents({ status: "active" }) });
  const enrolments = useQuery({ queryKey: ["hifz-enrolments", halqaFilter], queryFn: () => listEnrolments({ halqa_id: halqaFilter || undefined }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hifz-enrolments"] });

  const enrol = useMutation({
    mutationFn: () => createEnrolment({ halqa_id: halqaId, student_id: student!.id, current_juz: Number(juz), current_page: Number(page) }),
    onSuccess: () => { setOpen(false); setStudent(null); setJuz("1"); setPage("1"); invalidate(); qc.invalidateQueries({ queryKey: ["hifz-halqas"] }); },
    onError: (e: unknown) => setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not enrol."),
  });
  const advance = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => updateEnrolment(id, patch),
    onSuccess: invalidate,
  });

  return (
    <AppShell title="Hifz — Enrolments" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Hifz Students</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setHalqaId(halqas.data?.[0]?.id ?? ""); setOpen(true); }}>Enrol Student</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField select size="small" label="Halqa" value={halqaFilter} onChange={(e) => setHalqaFilter(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">All halqas</MenuItem>
          {(halqas.data ?? []).map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
        </TextField>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Student</TableCell><TableCell>Halqa</TableCell><TableCell align="center">Juz</TableCell>
            <TableCell align="center">Page</TableCell><TableCell align="right">Records</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {enrolments.isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
            ) : (enrolments.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No enrolments.</TableCell></TableRow>
            ) : enrolments.data!.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>{e.student_name}{e.admission_number && <div style={{ color: "#667085", fontSize: 12 }}>{e.admission_number}</div>}</TableCell>
                <TableCell>{e.halqa_name}</TableCell>
                <TableCell align="center">
                  <Button size="small" onClick={() => advance.mutate({ id: e.id, patch: { current_juz: Math.min(30, e.current_juz + 1) } })}>{e.current_juz} ▲</Button>
                </TableCell>
                <TableCell align="center">{e.current_page}</TableCell>
                <TableCell align="right">{e.records_count}</TableCell>
                <TableCell>
                  <TextField select size="small" variant="standard" value={e.status} onChange={(ev) => advance.mutate({ id: e.id, patch: { status: ev.target.value } })} slotProps={{ input: { disableUnderline: true } }}>
                    {(["active", "completed", "left"] as EnrolmentStatus[]).map((s) => <MenuItem key={s} value={s}><Chip size="small" color={STATUS_COLOR[s]} label={s} /></MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell align="right"><Button size="small" startIcon={<BookIcon />} onClick={() => setRecords(e)}>Records</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Enrol Student in Hifz</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Autocomplete
              options={students.data ?? []} getOptionLabel={(s) => `${s.full_name}${s.admission_number ? ` (${s.admission_number})` : ""}`}
              value={student} onChange={(_, v) => setStudent(v)}
              renderInput={(params) => <TextField {...params} size="small" label="Student" />}
            />
            <TextField select size="small" label="Halqa" value={halqaId} onChange={(e) => setHalqaId(e.target.value)}>
              {(halqas.data ?? []).map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="number" label="Current Juz" fullWidth value={juz} onChange={(e) => setJuz(e.target.value)} />
              <TextField size="small" type="number" label="Current Page" fullWidth value={page} onChange={(e) => setPage(e.target.value)} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => enrol.mutate()} disabled={!student || !halqaId || enrol.isPending}>Enrol</Button>
        </DialogActions>
      </Dialog>

      {records && <RecordsDialog enrolment={records} onClose={() => setRecords(null)} />}
    </AppShell>
  );
}
