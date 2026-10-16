import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { AppShell } from "../../components/AppShell";
import { useAuth } from "../../auth/AuthContext";
import { changePassword } from "../../api/auth";
import { apiErrorMessage } from "../../lib/apiError";
import { navItemsForRole } from "./roleNav";

export function ChangePasswordPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (next.length < 8) return setLocalError("New password must be at least 8 characters.");
    if (next !== confirm) return setLocalError("New password and confirmation do not match.");
    mutation.mutate();
  }

  return (
    <AppShell title="Change Password" subtitle="Account  /  Change Password" navItems={navItemsForRole(user?.role)}>
      <Paper variant="outlined" sx={{ maxWidth: 480, p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Change your password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose a strong password you don't use elsewhere.
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {mutation.isSuccess && <Alert severity="success">{mutation.data.message || "Password changed."}</Alert>}
            {(localError || mutation.isError) && (
              <Alert severity="error">{localError ?? apiErrorMessage(mutation.error, "Could not change password.")}</Alert>
            )}
            <TextField
              label="Current password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
            <TextField
              label="New password"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              autoComplete="new-password"
              helperText="At least 8 characters"
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Button type="submit" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Change password"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </AppShell>
  );
}
