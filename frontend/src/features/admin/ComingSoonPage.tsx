import { useParams } from "react-router-dom";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import ConstructionIcon from "@mui/icons-material/HandymanOutlined";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";

function prettify(slug: string | undefined): string {
  if (!slug) return "Feature";
  return slug
    .split("-")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Placeholder for Forza-parity pages that are in the navbar but not yet implemented. */
export function ComingSoonPage() {
  const { slug } = useParams();
  const title = prettify(slug);
  return (
    <AppShell title={title} navItems={adminNavItems}>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="h4">{title}</Typography>
          <Chip size="small" color="warning" label="Planned" />
        </Stack>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 2 }}>
          <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
              <ConstructionIcon />
              <Typography variant="h6">This screen is on the Forza-parity roadmap</Typography>
            </Box>
            <Typography color="text.secondary">
              The navigation now mirrors the Forza / Skoolzoom admin, in the same order. This feature is
              listed in the sidebar but its page hasn't been built yet. It will be implemented module by
              module. The modules already live in this build are fully functional.
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    </AppShell>
  );
}
