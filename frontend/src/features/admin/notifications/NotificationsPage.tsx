import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
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
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listStudents, type Student } from "../../../api/students";
import {
  listNotificationLogs,
  sendCustomEmail,
  sendFeeDueReminders,
  sendNotification,
  type NotificationChannel,
  type NotificationStatus,
} from "../../../api/notifications";

const STATUS_COLORS: Record<NotificationStatus, "success" | "error" | "default"> = {
  sent: "success",
  failed: "error",
  skipped: "default",
};

const EVENT_LABELS: Record<string, string> = {
  attendance_absent: "Attendance: Absent",
  payment_verified: "Payment Verified",
  fee_due_reminder: "Fee Due Reminder",
  broadcast: "Announcement",
  report_card: "Report Card",
  custom_email: "Email",
  admin_notification: "Notification",
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const logsQuery = useQuery({ queryKey: ["notification-logs"], queryFn: listNotificationLogs });
  const studentsQuery = useQuery({ queryKey: ["students", "active"], queryFn: () => listStudents({ status: "active" }) });
  const [daysAhead, setDaysAhead] = useState("3");
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const [recipient, setRecipient] = useState<Student | null>(null);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifChannel, setNotifChannel] = useState<NotificationChannel>("email");
  const [notifResult, setNotifResult] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailResult, setEmailResult] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const sendNotif = useMutation({
    mutationFn: () =>
      sendNotification({ student_id: recipient!.id, title: notifTitle, message: notifMessage, channel: notifChannel }),
    onSuccess: (logs) => {
      const sent = logs.filter((l) => l.status === "sent").length;
      setNotifResult(
        sent > 0
          ? { severity: "success", text: `Sent via ${notifChannel} to ${sent} recipient(s).` }
          : { severity: "error", text: `Not sent: ${logs[0]?.detail ?? "no recipient contact info on file"}.` },
      );
      setNotifTitle("");
      setNotifMessage("");
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
    },
    onError: () => setNotifResult({ severity: "error", text: "Could not send the notification. Please try again." }),
  });

  const sendReminders = useMutation({
    mutationFn: () => sendFeeDueReminders(Number(daysAhead)),
    onSuccess: (result) => {
      setReminderMessage(`Checked ${result.invoices_checked} invoice(s), sent ${result.notifications_sent} notification(s).`);
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
    },
  });

  const sendEmail = useMutation({
    mutationFn: () => sendCustomEmail({ to_email: toEmail, subject, message: emailBody }),
    onSuccess: (log) => {
      setEmailResult(
        log.status === "sent"
          ? { severity: "success", text: `Email sent to ${log.recipient_email}.` }
          : { severity: "error", text: `Email not sent (${log.status}): ${log.detail ?? "unknown reason"}` },
      );
      setToEmail("");
      setSubject("");
      setEmailBody("");
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
    },
    onError: () => setEmailResult({ severity: "error", text: "Could not send the email. Please try again." }),
  });

  return (
    <AppShell title="Notifications" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Notifications
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        WhatsApp and email alerts go out automatically when a student is marked absent, a payment is verified, or a
        fee is due — connect a WhatsApp Business Cloud API token / SMTP credentials in the server configuration to
        actually deliver them. Until then, every attempt is still logged below as "Skipped" so you can see exactly
        what would have gone out.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Send notification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Compose a message for one student's parent and deliver it via exactly one channel — the other channel is
          never contacted.
        </Typography>
        <Stack spacing={2}>
          <Autocomplete
            options={studentsQuery.data ?? []}
            loading={studentsQuery.isLoading}
            getOptionLabel={(s) => s.full_name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={recipient}
            onChange={(_e, value) => setRecipient(value)}
            renderInput={(params) => <TextField {...params} label="Recipient (student)" size="small" />}
          />
          <TextField
            label="Notification title"
            size="small"
            value={notifTitle}
            onChange={(e) => setNotifTitle(e.target.value)}
            fullWidth
          />
          <TextField
            label="Message"
            multiline
            minRows={3}
            value={notifMessage}
            onChange={(e) => setNotifMessage(e.target.value)}
            fullWidth
          />
          <FormControl>
            <FormLabel sx={{ fontSize: 14 }}>Send via</FormLabel>
            <RadioGroup
              row
              value={notifChannel}
              onChange={(e) => setNotifChannel(e.target.value as NotificationChannel)}
            >
              <FormControlLabel value="email" control={<Radio size="small" />} label="Email" />
              <FormControlLabel value="whatsapp" control={<Radio size="small" />} label="WhatsApp" />
            </RadioGroup>
          </FormControl>
          <Button
            variant="contained"
            onClick={() => sendNotif.mutate()}
            disabled={sendNotif.isPending || !recipient || !notifTitle || !notifMessage}
            sx={{ alignSelf: "flex-start" }}
          >
            Send notification
          </Button>
        </Stack>
        {notifResult && (
          <Alert severity={notifResult.severity} sx={{ mt: 2 }}>
            {notifResult.text}
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Send fee due reminders
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <TextField
            label="Days ahead"
            type="number"
            size="small"
            value={daysAhead}
            onChange={(e) => setDaysAhead(e.target.value)}
            sx={{ width: 140 }}
          />
          <Button variant="contained" onClick={() => sendReminders.mutate()} disabled={sendReminders.isPending}>
            Send reminders now
          </Button>
        </Stack>
        {reminderMessage && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {reminderMessage}
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Send an email
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Send a report or any other information to any email address — not limited to parents already in the
          system.
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Recipient email"
            type="email"
            size="small"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            fullWidth
          />
          <TextField label="Subject" size="small" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth />
          <TextField
            label="Message"
            multiline
            minRows={4}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            fullWidth
          />
          <Button
            variant="contained"
            onClick={() => sendEmail.mutate()}
            disabled={sendEmail.isPending || !toEmail || !subject || !emailBody}
            sx={{ alignSelf: "flex-start" }}
          >
            Send email
          </Button>
        </Stack>
        {emailResult && (
          <Alert severity={emailResult.severity} sx={{ mt: 2 }}>
            {emailResult.text}
          </Alert>
        )}
      </Paper>

      {logsQuery.data?.length === 0 && <Alert severity="info">No notification attempts yet.</Alert>}

      {!!logsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Sent at</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Recipient</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Detail</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logsQuery.data.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>{new Date(log.sent_at).toLocaleString()}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{log.channel}</TableCell>
                  <TableCell>{EVENT_LABELS[log.event] ?? log.event}</TableCell>
                  <TableCell>{log.recipient_email ?? log.recipient_phone ?? "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={log.status} color={STATUS_COLORS[log.status]} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell>{log.detail ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
