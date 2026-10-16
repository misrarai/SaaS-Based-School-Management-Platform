import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { getLibrarySettings, libraryErrorMessage, updateLibrarySettings, type LibrarySettings } from "../../../api/library";
import { libraryAdminNav, withLibraryNav } from "../../libraryShared";

const navItems = withLibraryNav(adminNavItems, libraryAdminNav);

type Form = Record<keyof LibrarySettings, string>;

const FIELDS: { key: keyof LibrarySettings; label: string; helper?: string; step?: string }[] = [
  { key: "student_loan_days", label: "Student loan period (days)" },
  { key: "student_max_books", label: "Student max books" },
  { key: "teacher_loan_days", label: "Teacher loan period (days)" },
  { key: "teacher_max_books", label: "Teacher max books" },
  { key: "staff_loan_days", label: "Staff loan period (days)" },
  { key: "staff_max_books", label: "Staff max books" },
  { key: "fine_per_day", label: "Late fine per day", step: "0.01", helper: "Charged for every day past the due date" },
  { key: "max_renewals", label: "Max renewals per issue" },
  { key: "reservation_hold_days", label: "Reservation hold (days)", helper: "How long a returned copy is held for pickup" },
];

export function LibrarySettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["library", "settings"], queryFn: getLibrarySettings });
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])) as Form);
    }
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      updateLibrarySettings(Object.fromEntries(FIELDS.map((f) => [f.key, Number(form![f.key])])) as Partial<LibrarySettings>),
    onSuccess: () => {
      setMessage({ severity: "success", text: "Library settings saved." });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (err) => setMessage({ severity: "error", text: libraryErrorMessage(err, "Could not save settings.") }),
  });

  return (
    <AppShell title="Library" navItems={navItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Library Settings
      </Typography>
      {!form ? (
        <Typography>Loading…</Typography>
      ) : (
        <Paper
          variant="outlined"
          component="form"
          sx={{ p: 3, borderRadius: 2, maxWidth: 720 }}
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            {FIELDS.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                type="number"
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                helperText={f.helper}
                required
                slotProps={{ htmlInput: { min: 0, step: f.step ?? "1" } }}
              />
            ))}
          </Box>
          {message && (
            <Alert severity={message.severity} sx={{ mt: 2 }} onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
          <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 2 }}>
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save settings
            </Button>
          </Stack>
        </Paper>
      )}
    </AppShell>
  );
}
