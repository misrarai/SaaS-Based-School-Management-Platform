import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { listNotices } from "../../../api/communication";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ParentNoticesPage() {
  const notices = useQuery({ queryKey: ["notices", "parent"], queryFn: () => listNotices() });
  const list = notices.data ?? [];
  const pinned = list.filter((n) => n.is_pinned);
  const regular = list.filter((n) => !n.is_pinned);

  return (
    <AppShell navItems={parentNavItems} title="Notices">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <CampaignIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>School Notices</Typography>
            <Typography variant="body2" color="text.secondary">Announcements from the school</Typography>
          </Box>
        </Stack>

        {!notices.isLoading && list.length === 0 && (
          <Alert severity="info">No notices posted yet.</Alert>
        )}

        {pinned.length > 0 && (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="warning.main" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <PushPinIcon fontSize="small" /> Pinned
            </Typography>
            {pinned.map((n) => (
              <Card key={n.id} sx={{ border: "2px solid", borderColor: "warning.main", borderRadius: 2 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700}>{n.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{n.body}</Typography>
                    </Stack>
                    <Stack alignItems="flex-end" spacing={0.5} sx={{ minWidth: 80 }}>
                      <Chip size="small" label="Pinned" color="warning" />
                      <Typography variant="caption" color="text.secondary">{formatDate(n.publish_date)}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        <Stack spacing={1.5}>
          {regular.map((n) => (
            <Card key={n.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Stack spacing={0.5} sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>{n.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{n.body}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, textAlign: "right" }}>
                    {formatDate(n.publish_date)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Stack>
    </AppShell>
  );
}
