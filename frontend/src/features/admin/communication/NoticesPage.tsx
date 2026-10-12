import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
import PushPinIcon from "@mui/icons-material/PushPin";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  NOTICE_AUDIENCE_LABELS,
  createNotice,
  deleteNotice,
  listNotices,
  type NoticeAudience,
} from "../../../api/communication";
import { getClassesOverview } from "../../../api/classes";
import { CommunicationShell, PageHeader, errorMessage, fmtDate, todayIso } from "./common";

const AUDIENCES = Object.keys(NOTICE_AUDIENCE_LABELS) as NoticeAudience[];
const EMPTY = {
  title: "",
  body: "",
  audience: "all" as NoticeAudience,
  class_ids: [] as string[],
  publish_date: todayIso(),
  expiry_date: "",
  is_pinned: false,
};

export function NoticesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const notices = useQuery({ queryKey: ["comm-notices"], queryFn: () => listNotices(true) });
  const classes = useQuery({ queryKey: ["classes-overview"], queryFn: getClassesOverview });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["comm-notices"] });

  const add = useMutation({
    mutationFn: () =>
      createNotice({
        title: form.title,
        body: form.body,
        audience: form.audience,
        class_ids: form.audience === "classes" ? form.class_ids : null,
        publish_date: form.publish_date,
        expiry_date: form.expiry_date || null,
        is_pinned: form.is_pinned,
      }),
    onSuccess: () => { setOpen(false); setForm(EMPTY); invalidate(); },
    onError: (e) => setError(errorMessage(e, "Could not publish the notice.")),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteNotice(id), onSuccess: invalidate });

  return (
    <CommunicationShell title="Notice Board">
      <PageHeader
        title="Notice Board"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setError(null); setOpen(true); }}>New Notice</Button>}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Audience</TableCell>
              <TableCell>Published</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notices.isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
            ) : (notices.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No notices.</TableCell></TableRow>
            ) : (
              notices.data!.map((n) => (
                <TableRow key={n.id} hover>
                  <TableCell>
                    {n.is_pinned && <PushPinIcon fontSize="inherit" sx={{ mr: 0.5, color: "warning.main", verticalAlign: "middle" }} />}
                    {n.title}
                    <div style={{ color: "#667085", fontSize: 12, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>
                  </TableCell>
                  <TableCell><Chip size="small" label={NOTICE_AUDIENCE_LABELS[n.audience]} /></TableCell>
                  <TableCell>{fmtDate(n.publish_date)}</TableCell>
                  <TableCell>{n.expiry_date ? fmtDate(n.expiry_date) : "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => remove.mutate(n.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Notice</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField size="small" label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <TextField size="small" label="Body" multiline minRows={3} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="Audience" fullWidth value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as NoticeAudience }))}>
                {AUDIENCES.map((a) => <MenuItem key={a} value={a}>{NOTICE_AUDIENCE_LABELS[a]}</MenuItem>)}
              </TextField>
              {form.audience === "classes" && (
                <TextField
                  select size="small" label="Classes" fullWidth
                  slotProps={{ select: { multiple: true } }}
                  value={form.class_ids}
                  onChange={(e) => setForm((f) => ({ ...f, class_ids: e.target.value as unknown as string[] }))}
                >
                  {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
              )}
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" type="date" label="Publish date" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.publish_date} onChange={(e) => setForm((f) => ({ ...f, publish_date: e.target.value }))} />
              <TextField size="small" type="date" label="Expiry (optional)" fullWidth slotProps={{ inputLabel: { shrink: true } }} value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
            </Stack>
            <FormControlLabel control={<Switch checked={form.is_pinned} onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))} />} label="Pin to top" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!form.title.trim() || !form.body.trim() || add.isPending}>Publish</Button>
        </DialogActions>
      </Dialog>
    </CommunicationShell>
  );
}
