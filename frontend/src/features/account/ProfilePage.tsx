import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Avatar, Box, Button, Chip, Divider, Grid, Paper, Stack, Typography } from "@mui/material";
import { AppShell } from "../../components/AppShell";
import { useAuth } from "../../auth/AuthContext";
import { fetchCurrentUser, resendVerification } from "../../api/auth";
import { getMyTenant } from "../../api/tenants";
import { apiErrorMessage } from "../../lib/apiError";
import { navItemsForRole } from "./roleNav";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const meQuery = useQuery({ queryKey: ["auth-me"], queryFn: fetchCurrentUser });
  const tenantQuery = useQuery({
    queryKey: ["tenant-me"],
    queryFn: getMyTenant,
    enabled: user?.role === "admin",
    retry: false,
  });
  const resend = useMutation({ mutationFn: resendVerification });
  const me = meQuery.data ?? user;

  return (
    <AppShell title="My Profile" subtitle="Account  /  Profile" navItems={navItemsForRole(user?.role)}>
      <Paper variant="outlined" sx={{ maxWidth: 720, p: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
          <Avatar sx={{ width: 64, height: 64, bgcolor: "secondary.main", fontSize: 24 }}>
            {me?.full_name?.[0]?.toUpperCase() ?? "?"}
          </Avatar>
          <Box>
            <Typography variant="h6">{me?.full_name}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
              <Chip size="small" label={me?.role} sx={{ textTransform: "capitalize" }} />
              <Chip
                size="small"
                color={me?.is_verified ? "success" : "warning"}
                label={me?.is_verified ? "Email verified" : "Email not verified"}
              />
              {me && !me.is_active && <Chip size="small" color="error" label="Inactive" />}
            </Stack>
          </Box>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Field label="Full name" value={me?.full_name ?? "—"} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Field label="Email" value={me?.email ?? "—"} />
          </Grid>
          {tenantQuery.data && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="School" value={tenantQuery.data.name} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="School code" value={tenantQuery.data.slug} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Plan" value={tenantQuery.data.plan} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="School contact email" value={tenantQuery.data.contact_email} />
              </Grid>
            </>
          )}
        </Grid>

        {me && !me.is_verified && (
          <Box sx={{ mt: 3 }}>
            {resend.isSuccess && (
              <Alert severity="success" sx={{ mb: 1 }}>
                {resend.data.message || "Verification email sent."}
              </Alert>
            )}
            {resend.isError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {apiErrorMessage(resend.error, "Could not send verification email.")}
              </Alert>
            )}
            <Button variant="outlined" onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isPending ? "Sending…" : "Resend verification email"}
            </Button>
          </Box>
        )}

        <Box sx={{ mt: 3 }}>
          <Button component={RouterLink} to="/account/password" variant="contained">
            Change password
          </Button>
        </Box>
      </Paper>
    </AppShell>
  );
}
