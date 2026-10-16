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
import { studentNavItems } from "../studentNav";
import { listNotices } from "../../../api/communication";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function StudentNoticesPage() {
  const notices = useQuery({
    queryKey: ["notices", "student"],
    queryFn: () => listNotices(),
  });

  const list = notices.data ?? [];
  const pinned = list.filter((n) => n.is_pinned);
  const regular = list.filter((n) => !n.is_pinned);

  return (
    <AppShell navItems={studentNavItems} title="Notices">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <CampaignIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>School Notices</Typography>
            <Typography variant="body2" color="text.secondary">
              Announcements and updates from school
            </Typography>
          </Box>
        </Stack>

        {!notices.isLoading && list.length === 0 && (
          <Alert severity="info">No notices posted yet. Check back later.</Alert>
        )}

        {/* Pinned */}
        {pinned.length > 0 && (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="warning.main" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <PushPinIcon fontSize="small" /> Pinned Notices
            </Typography>
            {pinned.map((n) => (
              <Card key={n.id} sx={{ border: "2px solid", borderColor: "warning.main", borderRadius: 2 }}>
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700}>{n.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{n.body}</Typography>
                    </Stack>
                    <Stack spacing={0.5} alignItems="flex-end" sx={{ minWidth: 80 }}>
                      <Chip size="small" label="Pinned" color="warning" icon={<PushPinIcon />} />
                      <Typography variant="caption" color="text.secondary">{formatDate(n.publish_date)}</Typography>
                    </Stack>
                  </Stack>
                  {n.expiry_date && (
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block" }}>
                      Valid until {formatDate(n.expiry_date)}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {/* Regular */}
        {regular.length > 0 && (
          <Stack spacing={1.5}>
            {pinned.length > 0 && (
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                All Notices
              </Typography>
            )}
            {regular.map((n) => (
              <Card key={n.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
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
        )}
      </Stack>
    </AppShell>
  );
}
