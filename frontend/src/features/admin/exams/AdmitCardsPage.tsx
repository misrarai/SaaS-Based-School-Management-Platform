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
import DownloadIcon from "@mui/icons-material/Download";
import BlockIcon from "@mui/icons-material/Block";
import CheckIcon from "@mui/icons-material/CheckCircle";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  downloadAdmitCard,
  holdAdmitCard,
  listAdmitCards,
  listExams,
  releaseAdmitCard,
  type AdmitCardRow,
} from "../../../api/exams";

function errMsg(e: unknown, fb: string): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof d === "string" ? d : fb;
}

export function AdmitCardsPage() {
  const qc = useQueryClient();
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [holdFor, setHoldFor] = useState<AdmitCardRow | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  const exams = useQuery({ queryKey: ["exams"], queryFn: listExams });
  const exam = useMemo(() => exams.data?.find((e) => e.id === examId), [exams.data, examId]);

  const rows = useQuery({
    queryKey: ["admit-cards", examId, classId],
    queryFn: () => listAdmitCards(examId, classId),
    enabled: !!examId && !!classId,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admit-cards"] });

  const hold = useMutation({
    mutationFn: () => holdAdmitCard(examId, holdFor!.student_id, reason),
    onSuccess: () => { setHoldFor(null); setReason(""); invalidate(); },
    onError: (e) => setNotice({ type: "error", msg: errMsg(e, "Could not place hold.") }),
  });
  const release = useMutation({
    mutationFn: (studentId: string) => releaseAdmitCard(examId, studentId),
    onSuccess: invalidate,
  });
  const download = useMutation({
    mutationFn: (studentId: string) => downloadAdmitCard(examId, studentId),
    onError: (e) => setNotice({ type: "error", msg: errMsg(e, "Could not generate the admit card.") }),
  });

  return (
    <AppShell title="Examination — Admit Cards" navItems={adminNavItems}>
      <h2 style={{ marginTop: 0 }}>Admit Cards</h2>

      {notice && <Alert severity={notice.type} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.msg}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField select size="small" label="Exam" value={examId} onChange={(e) => { setExamId(e.target.value); setClassId(""); }} sx={{ minWidth: 220 }}>
          {(exams.data ?? []).map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!exam} sx={{ minWidth: 200 }}>
          {(exam?.classes ?? []).map((c) => <MenuItem key={c.class_grade_id} value={c.class_grade_id}>{c.class_name}</MenuItem>)}
        </TextField>
      </Paper>

      {!examId || !classId ? (
        <Alert severity="info">Pick an exam and class to list students and issue admit cards.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Roll</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Admission #</TableCell>
                <TableCell>Eligibility</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.isLoading ? (
                <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
              ) : (rows.data?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No students in this class.</TableCell></TableRow>
              ) : (
                rows.data!.map((r) => (
                  <TableRow key={r.student_id} hover>
                    <TableCell>{r.roll_number || "—"}</TableCell>
                    <TableCell>{r.full_name}</TableCell>
                    <TableCell>{r.admission_number || "—"}</TableCell>
                    <TableCell>
                      {r.eligible ? (
                        <Chip size="small" color="success" label="Eligible" />
                      ) : (
                        <Chip size="small" color="error" label={`On hold: ${r.hold_reason}`} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                        {r.eligible ? (
                          <>
                            <Button size="small" startIcon={<DownloadIcon />} onClick={() => download.mutate(r.student_id)}>Card</Button>
                            <Button size="small" color="warning" startIcon={<BlockIcon />} onClick={() => { setHoldFor(r); setReason(""); }}>Hold</Button>
                          </>
                        ) : (
                          <Button size="small" color="success" startIcon={<CheckIcon />} onClick={() => release.mutate(r.student_id)}>Release</Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!holdFor} onClose={() => setHoldFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>Hold admit card — {holdFor?.full_name}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" label="Reason" placeholder="e.g. Unpaid dues" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHoldFor(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => hold.mutate()} disabled={!reason.trim() || hold.isPending}>Place Hold</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
