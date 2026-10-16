import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AddCommentIcon from "@mui/icons-material/AddComment";
import {
  createThread,
  getThread,
  listContacts,
  listThreads,
  postMessage,
  type Contact,
} from "../../../api/communication";
import { CommunicationShell, PageHeader, fmtDateTime } from "./common";

export function MessagesPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [recipients, setRecipients] = useState<Contact[]>([]);
  const [firstMessage, setFirstMessage] = useState("");

  const threads = useQuery({ queryKey: ["comm-threads"], queryFn: listThreads });
  const contacts = useQuery({ queryKey: ["comm-contacts"], queryFn: () => listContacts() });
  const thread = useQuery({
    queryKey: ["comm-thread", activeId],
    queryFn: () => getThread(activeId!),
    enabled: !!activeId,
  });

  const refreshThreads = () => qc.invalidateQueries({ queryKey: ["comm-threads"] });

  const send = useMutation({
    mutationFn: () => postMessage(activeId!, draft.trim()),
    onSuccess: () => { setDraft(""); qc.invalidateQueries({ queryKey: ["comm-thread", activeId] }); refreshThreads(); },
  });
  const start = useMutation({
    mutationFn: () => createThread({ subject: subject.trim(), participant_user_ids: recipients.map((r) => r.user_id), body: firstMessage.trim() }),
    onSuccess: (t) => {
      setComposeOpen(false); setSubject(""); setRecipients([]); setFirstMessage("");
      refreshThreads(); setActiveId(t.id);
    },
  });

  return (
    <CommunicationShell title="Messages">
      <PageHeader
        title="Messages"
        action={<Button variant="contained" startIcon={<AddCommentIcon />} onClick={() => setComposeOpen(true)}>New Message</Button>}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: 2, height: 560 }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "auto" }}>
          <List disablePadding>
            {(threads.data?.length ?? 0) === 0 ? (
              <Box sx={{ p: 2, color: "text.secondary" }}>No conversations yet.</Box>
            ) : (
              threads.data!.map((t) => (
                <ListItemButton key={t.id} selected={t.id === activeId} onClick={() => setActiveId(t.id)}>
                  <ListItemText
                    primary={
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                        <span>{t.subject}</span>
                        {t.unread_count > 0 && <Chip size="small" color="primary" label={t.unread_count} />}
                      </Stack>
                    }
                    secondary={t.last_message_preview || t.participants.map((p) => p.full_name).join(", ")}
                    slotProps={{ secondary: { noWrap: true } }}
                  />
                </ListItemButton>
              ))
            )}
          </List>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2, display: "flex", flexDirection: "column" }}>
          {!activeId ? (
            <Box sx={{ m: "auto", color: "text.secondary" }}>Select a conversation or start a new one.</Box>
          ) : (
            <>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="h6">{thread.data?.subject}</Typography>
                <Typography variant="caption" color="text.secondary">{thread.data?.participants.map((p) => `${p.full_name} (${p.role})`).join(", ")}</Typography>
              </Box>
              <Box sx={{ flex: 1, overflow: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {(thread.data?.messages ?? []).map((m) => (
                  <Box key={m.id} sx={{ alignSelf: m.is_mine ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                    <Box sx={{ bgcolor: m.is_mine ? "primary.main" : "grey.100", color: m.is_mine ? "primary.contrastText" : "text.primary", px: 1.5, py: 1, borderRadius: 2 }}>
                      {!m.is_mine && <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>{m.sender_name}</Typography>}
                      {m.body}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: m.is_mine ? "right" : "left" }}>{fmtDateTime(m.created_at)}</Typography>
                  </Box>
                ))}
              </Box>
              <Divider />
              <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                <TextField size="small" fullWidth placeholder="Type a message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) send.mutate(); }} />
                <IconButton color="primary" onClick={() => send.mutate()} disabled={!draft.trim() || send.isPending}><SendIcon /></IconButton>
              </Stack>
            </>
          )}
        </Paper>
      </Box>

      <Dialog open={composeOpen} onClose={() => setComposeOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Message</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              multiple options={contacts.data ?? []} getOptionLabel={(c) => `${c.full_name} (${c.role})`}
              value={recipients} onChange={(_, v) => setRecipients(v)}
              renderInput={(params) => <TextField {...params} size="small" label="Recipients" placeholder="Search people…" />}
            />
            <TextField size="small" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <TextField size="small" label="Message" multiline minRows={3} value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComposeOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => start.mutate()} disabled={!subject.trim() || recipients.length === 0 || !firstMessage.trim() || start.isPending}>Send</Button>
        </DialogActions>
      </Dialog>
    </CommunicationShell>
  );
}
