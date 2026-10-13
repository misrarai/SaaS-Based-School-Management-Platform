import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import MessageIcon from "@mui/icons-material/MessageOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { apiClient } from "../../../api/client";

interface ParentMessage {
  id: string;
  subject: string;
  body: string;
  sender_name: string;
  sent_at: string;
  student_name: string;
  channel: "email" | "whatsapp" | "sms" | "app";
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(isoDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ParentMessagesPage() {
  const msgs = useQuery<ParentMessage[]>({
    queryKey: ["parent-messages"],
    queryFn: () =>
      apiClient.get<ParentMessage[]>("/communication/messages/inbox").then((r) => r.data),
  });

  const list = msgs.data ?? [];

  return (
    <AppShell navItems={parentNavItems} title="Messages from School">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <MessageIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Messages from School
          </Typography>
        </Stack>

        {msgs.isLoading && (
          <Typography color="text.secondary">Loading messages…</Typography>
        )}

        {!msgs.isLoading && list.length === 0 && (
          <Alert severity="info" icon={<SchoolIcon />}>
            No messages yet. When a teacher sends you a message or progress report, it
            will appear here.
          </Alert>
        )}

        {list.map((msg) => (
          <Card key={msg.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack spacing={1.5}>
                {/* Header */}
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, fontSize: 14 }}>
                      {msg.sender_name?.[0]?.toUpperCase() ?? "T"}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {msg.sender_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Re: {msg.student_name}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {timeAgo(msg.sent_at)}
                    </Typography>
                    <Chip
                      size="small"
                      label={msg.channel}
                      color={
                        msg.channel === "whatsapp"
                          ? "success"
                          : msg.channel === "email"
                          ? "primary"
                          : "default"
                      }
                    />
                  </Stack>
                </Stack>

                <Divider />

                {/* Subject */}
                <Typography variant="subtitle1" fontWeight={600}>
                  {msg.subject}
                </Typography>

                {/* Body */}
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
                >
                  {msg.body}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </AppShell>
  );
}
