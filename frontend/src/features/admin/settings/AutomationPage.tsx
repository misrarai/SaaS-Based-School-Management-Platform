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
  Switch,
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
import ScienceIcon from "@mui/icons-material/ScienceOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  EVENT_LABELS, EVENT_TOKENS, createAutomationRule, deleteAutomationRule, listAutomationRules,
  listAutomationRuns, testAutomationRule, updateAutomationRule,
  type AutomationChannel, type AutomationEvent, type AutomationRule, type AutomationTestResult,
} from "../../../api/automation";

const EVENTS = Object.keys(EVENT_LABELS) as AutomationEvent[];
const CHANNELS: AutomationChannel[] = ["sms", "email", "whatsapp"];
const EMPTY = { name: "", event: "student_absent" as AutomationEvent, channel: "sms" as AutomationChannel, subject: "", message_template: "" };

export function AutomationPage() {
  const qc = useQueryClient();
  const [dlg, setDlg] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<AutomationTestResult | null>(null);

  const rules = useQuery({ queryKey: ["automation-rules"], queryFn: listAutomationRules });
  const runs = useQuery({ queryKey: ["automation-runs"], queryFn: listAutomationRuns });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["automation-rules"] }); qc.invalidateQueries({ queryKey: ["automation-runs"] }); };

  const create = useMutation({
    mutationFn: () => createAutomationRule({ ...form, subject: form.channel === "email" ? form.subject : undefined }),
    onSuccess: () => { setDlg(false); setForm(EMPTY); invalidate(); },
    onError: (e: unknown) => setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not save the rule."),
  });
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => updateAutomationRule(id, { is_active: active }), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => deleteAutomationRule(id), onSuccess: invalidate });
  const runTest = useMutation({ mutationFn: (id: string) => testAutomationRule(id), onSuccess: (r) => setTest(r) });

  const tokens = EVENT_TOKENS[form.event];

  return (
    <AppShell title="Settings — Auto Notifications" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">Auto Notifications</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY); setError(null); setDlg(true); }}>New Rule</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        When an event happens, every active rule for it sends its message to the students' parents through the chosen channel.
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Rule</TableCell><TableCell>When</TableCell><TableCell>Channel</TableCell>
            <TableCell>Message</TableCell><TableCell>Active</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {rules.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : (rules.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No automation rules yet.</TableCell></TableRow>
            ) : rules.data!.map((r: AutomationRule) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>{EVENT_LABELS[r.event]}</TableCell>
                <TableCell><Chip size="small" label={r.channel} /></TableCell>
                <TableCell sx={{ maxWidth: 320, color: "text.secondary", fontSize: 13 }}>{r.message_template}</TableCell>
                <TableCell><Switch size="small" checked={r.is_active} onChange={(e) => toggle.mutate({ id: r.id, active: e.target.checked })} /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => runTest.mutate(r.id)} title="Test"><ScienceIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => remove.mutate(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1 }}>Recent activity</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>When</TableCell><TableCell>Event</TableCell><TableCell align="right">Recipients</TableCell>
            <TableCell align="right">Sent</TableCell><TableCell align="right">Skipped</TableCell><TableCell>Detail</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {(runs.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No rules have fired yet.</TableCell></TableRow>
            ) : runs.data!.map((run) => (
              <TableRow key={run.id} hover>
                <TableCell>{new Date(run.fired_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                <TableCell>{EVENT_LABELS[run.event as AutomationEvent] ?? run.event}</TableCell>
                <TableCell align="right">{run.recipients}</TableCell>
                <TableCell align="right">{run.sent}</TableCell>
                <TableCell align="right">{run.skipped}</TableCell>
                <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{run.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dlg} onClose={() => setDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Automation Rule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField size="small" label="Rule name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="When this happens" fullWidth value={form.event} onChange={(e) => setForm((f) => ({ ...f, event: e.target.value as AutomationEvent }))}>
                {EVENTS.map((ev) => <MenuItem key={ev} value={ev}>{EVENT_LABELS[ev]}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Send via" fullWidth value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as AutomationChannel }))}>
                {CHANNELS.map((c) => <MenuItem key={c} value={c}>{c.toUpperCase()}</MenuItem>)}
              </TextField>
            </Stack>
            {form.channel === "email" && <TextField size="small" label="Email subject" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />}
            <TextField size="small" label="Message" multiline minRows={3} value={form.message_template} onChange={(e) => setForm((f) => ({ ...f, message_template: e.target.value }))} />
            <Box>
              <Typography variant="caption" color="text.secondary">Available tokens: </Typography>
              {tokens.map((t) => (
                <Chip key={t} size="small" label={`{${t}}`} sx={{ mr: 0.5, cursor: "pointer" }} onClick={() => setForm((f) => ({ ...f, message_template: f.message_template + `{${t}}` }))} />
              ))}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => create.mutate()} disabled={!form.name.trim() || !form.message_template.trim() || create.isPending}>Save Rule</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!test} onClose={() => setTest(null)} fullWidth maxWidth="sm">
        <DialogTitle>Test preview</DialogTitle>
        <DialogContent>
          {test && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">{test.detail}</Alert>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, whiteSpace: "pre-wrap" }}>{test.preview}</Paper>
            </Stack>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setTest(null)}>Close</Button></DialogActions>
      </Dialog>
    </AppShell>
  );
}
