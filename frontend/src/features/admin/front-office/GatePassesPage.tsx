import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createGatePass,
  deleteGatePass,
  listGatePasses,
  lookupStudentByAdmission,
  openGatePassPdf,
  type StudentLookup,
} from "../../../api/frontOffice";
import { FrontOfficeShell, PageHeader, errorMessage, fmtDateTime, localInputToIso, todayIso } from "./common";

const EMPTY = { reason: "", guardian_name: "", guardian_relation: "", guardian_cnic: "", guardian_phone: "", out_time: "", approved_by: "" };

export function GatePassesPage() {
  const queryClient = useQueryClient();
  const [day, setDay] = useState(todayIso());
  const [open, setOpen] = useState(false);
  const [admission, setAdmission] = useState("");
  const [student, setStudent] = useState<StudentLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const passes = useQuery({ queryKey: ["fo-gate-passes", day], queryFn: () => listGatePasses(day) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fo-gate-passes"] });

  const lookup = useMutation({
    mutationFn: () => lookupStudentByAdmission(admission.trim()),
    onSuccess: (s) => {
      setStudent(s);
      setLookupError(null);
      setForm((f) => ({ ...f, guardian_name: f.guardian_name || s.guardian_name || "" }));
    },
    onError: (e) => {
      setStudent(null);
      setLookupError(errorMessage(e, "Student not found."));
    },
  });
  const add = useMutation({
    mutationFn: () =>
      createGatePass({
        student_id: student!.student_id,
        reason: form.reason,
        guardian_name: form.guardian_name,
        guardian_relation: form.guardian_relation || undefined,
        guardian_cnic: form.guardian_cnic || undefined,
        guardian_phone: form.guardian_phone || undefined,
        out_time: localInputToIso(form.out_time),
        approved_by: form.approved_by || undefined,
      }),
    onSuccess: (gp) => {
      close();
      invalidate();
      openGatePassPdf(gp.id);
    },
    onError: (e) => setError(errorMessage(e, "Could not issue gate pass.")),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteGatePass(id), onSuccess: invalidate });

  function close() {
    setOpen(false);
    setAdmission("");
    setStudent(null);
    setLookupError(null);
    setForm(EMPTY);
    setError(null);
  }
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <FrontOfficeShell title="Gate Passes">
      <PageHeader
        title="Student Gate Passes"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Issue gate pass
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField size="small" type="date" label="Date" value={day} onChange={(e) => setDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Paper>

      {passes.isLoading && <Typography>Loading…</Typography>}
      {passes.data?.length === 0 && <Alert severity="info">No gate passes issued on this date.</Alert>}
      {!!passes.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Pass #</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Adm. No.</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Picked up by</TableCell>
                <TableCell>Out time</TableCell>
                <TableCell>Approved by</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {passes.data.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{String(p.pass_number).padStart(5, "0")}</TableCell>
                  <TableCell>{p.student_name}</TableCell>
                  <TableCell>{p.admission_number ?? "—"}</TableCell>
                  <TableCell>{[p.class_name, p.section_name].filter(Boolean).join(" - ") || "—"}</TableCell>
                  <TableCell>{p.reason}</TableCell>
                  <TableCell>
                    {p.guardian_name}
                    {p.guardian_relation ? ` (${p.guardian_relation})` : ""}
                  </TableCell>
                  <TableCell>{fmtDateTime(p.out_time)}</TableCell>
                  <TableCell>{p.approved_by ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Print gate pass">
                      <IconButton size="small" onClick={() => openGatePassPdf(p.id)}>
                        <PictureAsPdfIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" color="error" onClick={() => window.confirm("Delete this gate pass?") && remove.mutate(p.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>Issue gate pass</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); if (student) add.mutate(); }}>
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Admission number"
                  value={admission}
                  onChange={(e) => setAdmission(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (admission.trim()) lookup.mutate();
                    }
                  }}
                  fullWidth
                  autoFocus
                />
                <Button variant="outlined" onClick={() => lookup.mutate()} disabled={!admission.trim() || lookup.isPending}>
                  Find
                </Button>
              </Stack>
              {lookupError && <Alert severity="warning">{lookupError}</Alert>}
              {student && (
                <Alert severity="success">
                  <strong>{student.full_name}</strong> — {[student.class_name, student.section_name].filter(Boolean).join(" - ") || "No class"}
                </Alert>
              )}
              <TextField label="Reason" value={form.reason} onChange={(e) => set({ reason: e.target.value })} required fullWidth />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Guardian picking up" value={form.guardian_name} onChange={(e) => set({ guardian_name: e.target.value })} required fullWidth />
                <TextField label="Relation" value={form.guardian_relation} onChange={(e) => set({ guardian_relation: e.target.value })} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Guardian CNIC" value={form.guardian_cnic} onChange={(e) => set({ guardian_cnic: e.target.value })} fullWidth />
                <TextField label="Guardian phone" value={form.guardian_phone} onChange={(e) => set({ guardian_phone: e.target.value })} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Out time (blank = now)" type="datetime-local" value={form.out_time} onChange={(e) => set({ out_time: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Approved by (blank = you)" value={form.approved_by} onChange={(e) => set({ approved_by: e.target.value })} fullWidth />
              </Stack>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!student || add.isPending}>
              Issue & print
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </FrontOfficeShell>
  );
}
