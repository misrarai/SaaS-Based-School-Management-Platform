import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Divider,
  IconButton,
  InputAdornment,
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
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses } from "../../../api/classes";
import {
  ENQUIRY_SOURCES,
  ENQUIRY_STATUS_LABELS,
  addFollowUp,
  convertEnquiry,
  createEnquiry,
  deleteEnquiry,
  getEnquirySummary,
  listEnquiries,
  listFollowUps,
  updateEnquiry,
  type Enquiry,
  type EnquiryConversionPrefill,
  type EnquiryPayload,
  type EnquirySource,
  type EnquiryStatus,
} from "../../../api/frontOffice";
import { FilterTabs, FrontOfficeShell, PageHeader, StatCard, errorMessage, fmtDate, todayIso } from "./common";

type Tab = "all" | EnquiryStatus;
const STATUS_COLORS: Record<EnquiryStatus, "info" | "warning" | "success" | "default"> = {
  new: "info",
  follow_up: "warning",
  converted: "success",
  closed: "default",
};

const EMPTY: EnquiryPayload = {
  student_name: "",
  parent_name: "",
  phone: "",
  email: "",
  class_grade_id: null,
  source: "walk_in",
  enquiry_date: todayIso(),
  follow_up_date: null,
  status: "new",
  notes: "",
  assigned_to: "",
};

function clean(p: EnquiryPayload): EnquiryPayload {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) out[k] = v === "" ? null : v;
  return out as EnquiryPayload;
}

export function EnquiriesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<EnquiryPayload | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Enquiry | null>(null);
  const [prefill, setPrefill] = useState<EnquiryConversionPrefill | null>(null);

  const enquiries = useQuery({ queryKey: ["fo-enquiries", tab, search], queryFn: () => listEnquiries({ status: tab, q: search }) });
  const summary = useQuery({ queryKey: ["fo-enquiries", "summary"], queryFn: getEnquirySummary });
  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fo-enquiries"] });

  const save = useMutation({
    mutationFn: () => (editingId ? updateEnquiry(editingId, clean(form!)) : createEnquiry(clean(form!))),
    onSuccess: () => {
      setForm(null);
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorMessage(e, "Could not save enquiry.")),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteEnquiry(id), onSuccess: invalidate });
  const convert = useMutation({
    mutationFn: (id: string) => convertEnquiry(id),
    onSuccess: (data) => {
      setPrefill(data);
      invalidate();
    },
  });

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY, enquiry_date: todayIso() });
    setError(null);
  }
  function openEdit(e: Enquiry) {
    setEditingId(e.id);
    setForm({ ...e });
    setError(null);
  }
  function goToAdmission(p: EnquiryConversionPrefill) {
    try {
      sessionStorage.setItem("admissionPrefill", JSON.stringify(p));
    } catch {
      /* storage unavailable — query params below still carry the basics */
    }
    const params = new URLSearchParams();
    params.set("full_name", p.full_name);
    if (p.guardian_name) params.set("guardian_name", p.guardian_name);
    if (p.class_grade_id) params.set("class_grade_id", p.class_grade_id);
    if (p.phone) params.set("phone", p.phone);
    if (p.email) params.set("email", p.email);
    params.set("from_enquiry", p.enquiry_id);
    navigate(`/admin/students/register?${params.toString()}`);
  }

  const s = summary.data;
  const set = (patch: Partial<EnquiryPayload>) => setForm((f) => ({ ...(f ?? EMPTY), ...patch }));

  return (
    <FrontOfficeShell title="Admission Enquiries">
      <PageHeader
        title="Admission Enquiries"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
            New enquiry
          </Button>
        }
      />

      <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <StatCard label="Total" value={s?.total ?? 0} />
        <StatCard label="New" value={s?.new ?? 0} color="#0288d1" />
        <StatCard label="Follow-up" value={s?.follow_up ?? 0} color="#ed6c02" />
        <StatCard label="Converted" value={s?.converted ?? 0} color="#2e7d32" />
        <StatCard label="Closed" value={s?.closed ?? 0} color="#757575" />
        <StatCard label="Follow-ups due" value={s?.due_follow_ups_today ?? 0} color="#d32f2f" />
      </Stack>

      <FilterTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[{ value: "all", label: "All" }, ...(Object.keys(ENQUIRY_STATUS_LABELS) as EnquiryStatus[]).map((k) => ({ value: k as Tab, label: ENQUIRY_STATUS_LABELS[k] }))]}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField
          size="small"
          placeholder="Search by student, parent or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 340, maxWidth: "100%" }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Paper>

      {enquiries.isLoading && <Typography>Loading…</Typography>}
      {enquiries.data?.length === 0 && <Alert severity="info">No enquiries in this view.</Alert>}
      {!!enquiries.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Parent</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Follow-up</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {enquiries.data.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell>{fmtDate(e.enquiry_date)}</TableCell>
                  <TableCell>{e.student_name}</TableCell>
                  <TableCell>{e.parent_name ?? "—"}</TableCell>
                  <TableCell>{e.phone ?? "—"}</TableCell>
                  <TableCell>{e.class_interested ?? "—"}</TableCell>
                  <TableCell>{ENQUIRY_SOURCES.find((x) => x.value === e.source)?.label ?? e.source}</TableCell>
                  <TableCell>{fmtDate(e.follow_up_date)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={ENQUIRY_STATUS_LABELS[e.status]} color={STATUS_COLORS[e.status]} />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" onClick={() => setFollowUpFor(e)}>
                      Follow-ups
                    </Button>
                    <Button size="small" onClick={() => openEdit(e)}>
                      Edit
                    </Button>
                    {e.status !== "converted" && e.status !== "closed" && (
                      <Button size="small" color="success" onClick={() => convert.mutate(e.id)}>
                        Convert
                      </Button>
                    )}
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => window.confirm("Delete this enquiry?") && remove.mutate(e.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Edit enquiry" : "New admission enquiry"}</DialogTitle>
        <Box component="form" onSubmit={(ev) => { ev.preventDefault(); save.mutate(); }}>
          <DialogContent>
            {form && (
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField label="Student name" value={form.student_name ?? ""} onChange={(e) => set({ student_name: e.target.value })} required fullWidth autoFocus />
                  <TextField label="Parent name" value={form.parent_name ?? ""} onChange={(e) => set({ parent_name: e.target.value })} fullWidth />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField label="Phone" value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} fullWidth />
                  <TextField label="Email" type="email" value={form.email ?? ""} onChange={(e) => set({ email: e.target.value })} fullWidth />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField select label="Class interested" value={form.class_grade_id ?? ""} onChange={(e) => set({ class_grade_id: e.target.value || null })} fullWidth>
                    <MenuItem value="">— Not specified —</MenuItem>
                    {classes.data?.map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField select label="Source" value={form.source ?? "walk_in"} onChange={(e) => set({ source: e.target.value as EnquirySource })} fullWidth>
                    {ENQUIRY_SOURCES.map((s) => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField label="Enquiry date" type="date" value={form.enquiry_date ?? ""} onChange={(e) => set({ enquiry_date: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField label="Next follow-up" type="date" value={form.follow_up_date ?? ""} onChange={(e) => set({ follow_up_date: e.target.value || null })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField select label="Status" value={form.status ?? "new"} onChange={(e) => set({ status: e.target.value as EnquiryStatus })} fullWidth>
                    {(Object.keys(ENQUIRY_STATUS_LABELS) as EnquiryStatus[]).map((k) => (
                      <MenuItem key={k} value={k}>{ENQUIRY_STATUS_LABELS[k]}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Assigned to" value={form.assigned_to ?? ""} onChange={(e) => set({ assigned_to: e.target.value })} fullWidth />
                </Stack>
                <TextField label="Notes" value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} fullWidth multiline minRows={2} />
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

      {followUpFor && <FollowUpDialog enquiry={followUpFor} onClose={() => setFollowUpFor(null)} />}

      <Dialog open={!!prefill} onClose={() => setPrefill(null)} fullWidth maxWidth="xs">
        <DialogTitle>Enquiry converted</DialogTitle>
        <DialogContent>
          {prefill && (
            <Stack spacing={1}>
              <Typography>
                <strong>{prefill.full_name}</strong> is marked as converted. Continue to the admission form with these details prefilled:
              </Typography>
              <Typography variant="body2">Guardian: {prefill.guardian_name ?? "—"}</Typography>
              <Typography variant="body2">Phone: {prefill.phone ?? "—"}</Typography>
              <Typography variant="body2">Class: {prefill.class_interested ?? "—"}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPrefill(null)}>Later</Button>
          <Button variant="contained" onClick={() => prefill && goToAdmission(prefill)}>Open admission form</Button>
        </DialogActions>
      </Dialog>
    </FrontOfficeShell>
  );
}

function FollowUpDialog({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const [status, setStatus] = useState<EnquiryStatus | "">("");
  const followUps = useQuery({ queryKey: ["fo-enquiries", "follow-ups", enquiry.id], queryFn: () => listFollowUps(enquiry.id) });
  const add = useMutation({
    mutationFn: () => addFollowUp(enquiry.id, { note, next_follow_up_date: next || undefined, status: status || undefined }),
    onSuccess: () => {
      setNote("");
      setNext("");
      setStatus("");
      queryClient.invalidateQueries({ queryKey: ["fo-enquiries"] });
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Follow-ups — {enquiry.student_name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {followUps.data?.length === 0 && <Typography color="text.secondary">No follow-ups logged yet.</Typography>}
          {followUps.data?.map((f) => (
            <Paper key={f.id} variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                {fmtDate(f.follow_up_date)}
                {f.next_follow_up_date ? ` · next: ${fmtDate(f.next_follow_up_date)}` : ""}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{f.note}</Typography>
            </Paper>
          ))}
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={2}>
          <TextField label="Follow-up note" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Next follow-up date" type="date" value={next} onChange={(e) => setNext(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField select label="Update status" value={status} onChange={(e) => setStatus(e.target.value as EnquiryStatus | "")} fullWidth>
              <MenuItem value="">— Keep —</MenuItem>
              {(Object.keys(ENQUIRY_STATUS_LABELS) as EnquiryStatus[]).map((k) => (
                <MenuItem key={k} value={k}>{ENQUIRY_STATUS_LABELS[k]}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" disabled={!note.trim() || add.isPending} onClick={() => add.mutate()}>
          Add follow-up
        </Button>
      </DialogActions>
    </Dialog>
  );
}
