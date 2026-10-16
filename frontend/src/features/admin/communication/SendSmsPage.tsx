import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
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
import SendIcon from "@mui/icons-material/Send";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listSmsLogs, sendSms, type SmsSendResult } from "../../../api/communication";
import { getClassesOverview } from "../../../api/classes";
import { CommunicationShell, PageHeader, errorMessage, fmtDateTime } from "./common";

const STATUS_COLOR: Record<string, "success" | "error" | "default"> = { sent: "success", failed: "error", skipped: "default" };

export function SendSmsPage() {
  const qc = useQueryClient();
  const [audience, setAudience] = useState<"all_parents" | "class_parents">("all_parents");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [message, setMessage] = useState("");
  const [emailFallback, setEmailFallback] = useState(true);
  const [result, setResult] = useState<SmsSendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classes = useQuery({ queryKey: ["classes-overview"], queryFn: getClassesOverview });
  const logs = useQuery({ queryKey: ["comm-sms-logs"], queryFn: listSmsLogs });
  const selectedClass = useMemo(() => classes.data?.find((c) => c.id === classId), [classes.data, classId]);

  const send = useMutation({
    mutationFn: () => sendSms({
      audience,
      class_grade_id: audience === "class_parents" ? classId : undefined,
      section_id: audience === "class_parents" && sectionId ? sectionId : undefined,
      message,
      email_fallback: emailFallback,
    }),
    onSuccess: (r) => {
      setResult(r); setError(null); setMessage("");
      qc.invalidateQueries({ queryKey: ["comm-sms-logs"] });
    },
    onError: (e) => { setError(errorMessage(e, "Could not send.")); setResult(null); },
  });

  const canSend = message.trim() && (audience === "all_parents" || classId);

  return (
    <CommunicationShell title="Send SMS">
      <PageHeader title="Send SMS to Parents" />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack spacing={2} sx={{ maxWidth: 640 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Alert severity="info">
              {result.recipients} recipients · SMS sent {result.sms_sent}, skipped {result.sms_skipped}, failed {result.sms_failed} · Email sent {result.email_sent}
            </Alert>
          )}
          <Stack direction="row" spacing={2}>
            <TextField select size="small" label="Audience" fullWidth value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
              <MenuItem value="all_parents">All parents</MenuItem>
              <MenuItem value="class_parents">Parents of a class</MenuItem>
            </TextField>
            {audience === "class_parents" && (
              <>
                <TextField select size="small" label="Class" fullWidth value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}>
                  {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Section" fullWidth value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!selectedClass}>
                  <MenuItem value="">All sections</MenuItem>
                  {(selectedClass?.sections ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              </>
            )}
          </Stack>
          <TextField size="small" label="Message" multiline minRows={3} value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1000))} helperText={`${message.length}/1000`} />
          <FormControlLabel control={<Switch checked={emailFallback} onChange={(e) => setEmailFallback(e.target.checked)} />} label="Email fallback when SMS unavailable" />
          <div>
            <Button variant="contained" startIcon={<SendIcon />} onClick={() => send.mutate()} disabled={!canSend || send.isPending}>
              {send.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </Stack>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>Recent sends</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Recipient</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Detail</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(logs.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No messages sent yet.</TableCell></TableRow>
            ) : (
              logs.data!.slice(0, 50).map((l) => (
                <TableRow key={l.id} hover>
                  <TableCell>{fmtDateTime(l.created_at)}</TableCell>
                  <TableCell>{l.channel}</TableCell>
                  <TableCell>{l.recipient_name || l.recipient_address || "—"}</TableCell>
                  <TableCell><Chip size="small" color={STATUS_COLOR[l.status] ?? "default"} label={l.status} /></TableCell>
                  <TableCell>{l.detail || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </CommunicationShell>
  );
}
