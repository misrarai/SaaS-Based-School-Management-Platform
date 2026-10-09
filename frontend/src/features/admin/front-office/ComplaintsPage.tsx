import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
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
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createComplaint,
  deleteComplaint,
  listComplaints,
  updateComplaint,
  type ComplainantType,
  type Complaint,
  type ComplaintPayload,
  type ComplaintStatus,
} from "../../../api/frontOffice";
import { FilterTabs, FrontOfficeShell, PageHeader, errorMessage, fmtDate, todayIso } from "./common";

type Tab = "all" | ComplaintStatus;
const STATUS_LABELS: Record<ComplaintStatus, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };
const STATUS_COLORS: Record<ComplaintStatus, "error" | "warning" | "success"> = { open: "error", in_progress: "warning", resolved: "success" };
const COMPLAINANTS: ComplainantType[] = ["parent", "student", "staff", "other"];

const EMPTY: ComplaintPayload = {
  complainant_type: "parent",
  complainant_name: "",
  phone: "",
  complaint_type: "",
  description: "",
  complaint_date: todayIso(),
  assigned_to: "",
  action_taken: "",
  status: "open",
};

export function ComplaintsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("open");
  const [form, setForm] = useState<ComplaintPayload | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const complaints = useQuery({ queryKey: ["fo-complaints", tab], queryFn: () => listComplaints({ status: tab }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fo-complaints"] });

  const save = useMutation({
    mutationFn: () => {
      const payload: ComplaintPayload = { ...form };
      for (const k of ["phone", "assigned_to", "action_taken"] as const) if (payload[k] === "") payload[k] = null;
      return editingId ? updateComplaint(editingId, payload) : createComplaint(payload);
    },
    onSuccess: () => {
      setForm(null);
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorMessage(e, "Could not save complaint.")),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteComplaint(id), onSuccess: invalidate });
  const set = (patch: Partial<ComplaintPayload>) => setForm((f) => ({ ...(f ?? EMPTY), ...patch }));

  function openEdit(c: Complaint) {
    setEditingId(c.id);
    setForm({ ...c });
    setError(null);
  }

  return (
    <FrontOfficeShell title="Complaints">
      <PageHeader
        title="Complaints"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingId(null); setForm({ ...EMPTY, complaint_date: todayIso() }); setError(null); }}>
            Register complaint
          </Button>
        }
      />
      <FilterTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "resolved", label: "Resolved" }]}
      />

      {complaints.isLoading && <Typography>Loading…</Typography>}
      {complaints.data?.length === 0 && <Alert severity="info">No complaints in this view.</Alert>}
      {!!complaints.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Complainant</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Assigned to</TableCell>
                <TableCell>Action taken</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {complaints.data.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{fmtDate(c.complaint_date)}</TableCell>
                  <TableCell>
                    {c.complainant_name}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", textTransform: "capitalize" }}>
                      {c.complainant_type}{c.phone ? ` · ${c.phone}` : ""}
                    </Typography>
                  </TableCell>
                  <TableCell>{c.complaint_type}</TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>{c.description}</TableCell>
                  <TableCell>{c.assigned_to ?? "—"}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>{c.action_taken ?? "—"}</TableCell>
                  <TableCell><Chip size="small" label={STATUS_LABELS[c.status]} color={STATUS_COLORS[c.status]} /></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" onClick={() => openEdit(c)}>Update</Button>
                    <IconButton size="small" color="error" onClick={() => window.confirm("Delete this complaint?") && remove.mutate(c.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Update complaint" : "Register complaint"}</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogContent>
            {form && (
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField select label="Complainant" value={form.complainant_type ?? "parent"} onChange={(e) => set({ complainant_type: e.target.value as ComplainantType })} fullWidth>
                    {COMPLAINANTS.map((c) => <MenuItem key={c} value={c} sx={{ textTransform: "capitalize" }}>{c}</MenuItem>)}
                  </TextField>
                  <TextField label="Name" value={form.complainant_name ?? ""} onChange={(e) => set({ complainant_name: e.target.value })} required fullWidth />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField label="Phone" value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} fullWidth />
                  <TextField label="Complaint type" placeholder="e.g. Transport, Academics, Fee" value={form.complaint_type ?? ""} onChange={(e) => set({ complaint_type: e.target.value })} required fullWidth />
                </Stack>
                <TextField label="Description" value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} required fullWidth multiline minRows={3} />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField label="Date" type="date" value={form.complaint_date ?? ""} onChange={(e) => set({ complaint_date: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField label="Assigned to" value={form.assigned_to ?? ""} onChange={(e) => set({ assigned_to: e.target.value })} fullWidth />
                </Stack>
                <TextField label="Action taken" value={form.action_taken ?? ""} onChange={(e) => set({ action_taken: e.target.value })} fullWidth multiline minRows={2} />
                <TextField select label="Status" value={form.status ?? "open"} onChange={(e) => set({ status: e.target.value as ComplaintStatus })} fullWidth>
                  {(Object.keys(STATUS_LABELS) as ComplaintStatus[]).map((k) => <MenuItem key={k} value={k}>{STATUS_LABELS[k]}</MenuItem>)}
                </TextField>
                {error && <Alert severity="error">{error}</Alert>}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setForm(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </FrontOfficeShell>
  );
}
