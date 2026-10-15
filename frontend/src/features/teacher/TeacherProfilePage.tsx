import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/EditOutlined";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import CancelIcon from "@mui/icons-material/CloseOutlined";
import { AppShell } from "../../components/AppShell";
import { teacherNavItems } from "./teacherNav";
import { getMyTeacherProfile, updateMyTeacherProfile } from "../../api/teachers";
import { apiErrorMessage } from "../../lib/apiError";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: "break-word" }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}

export function TeacherProfilePage() {
  const qc = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["teacher-me"], queryFn: getMyTeacherProfile });
  const profile = profileQuery.data;

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [qualification, setQualification] = useState("");

  function startEdit() {
    if (!profile) return;
    setFullName(profile.full_name);
    setPhone(profile.phone_number ?? "");
    setQualification(profile.qualification ?? "");
    setEditing(true);
  }

  const save = useMutation({
    mutationFn: () =>
      updateMyTeacherProfile({
        full_name: fullName.trim() || undefined,
        phone_number: phone.trim() || null,
        qualification: qualification.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-me"] });
      setEditing(false);
    },
  });

  return (
    <AppShell title="My Profile" navItems={teacherNavItems}>
      {profileQuery.isLoading && <Typography>Loading…</Typography>}
      {profileQuery.isError && <Alert severity="error">Could not load profile.</Alert>}

      {profile && (
        <Paper variant="outlined" sx={{ maxWidth: 720, p: 3, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: "secondary.main", fontSize: 24 }}>
              {profile.full_name[0]?.toUpperCase() ?? "?"}
            </Avatar>
            <Box>
              <Typography variant="h6">{profile.full_name}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Chip size="small" label="Teacher" />
                <Chip
                  size="small"
                  color={profile.is_active ? "success" : "error"}
                  label={profile.is_active ? "Active" : "Inactive"}
                />
              </Stack>
            </Box>
            {!editing && (
              <Button sx={{ ml: "auto" }} startIcon={<EditIcon />} variant="outlined" size="small" onClick={startEdit}>
                Edit
              </Button>
            )}
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {!editing ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Full name" value={profile.full_name} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Email" value={profile.email} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Phone" value={profile.phone_number ?? ""} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Employee ID" value={profile.employee_code ?? ""} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Joining date" value={profile.hire_date ?? ""} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Field label="Qualification" value={profile.qualification ?? ""} />
              </Grid>
            </Grid>
          ) : (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    fullWidth
                  />
                </Stack>
                <TextField
                  label="Qualification"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  fullWidth
                />
                <TextField label="Employee ID" value={profile.employee_code ?? "—"} disabled fullWidth helperText="Contact admin to update" />
                <TextField label="Joining date" value={profile.hire_date ?? "—"} disabled fullWidth helperText="Contact admin to update" />
                {save.isError && <Alert severity="error">{apiErrorMessage(save.error, "Could not save changes.")}</Alert>}
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button startIcon={<CancelIcon />} onClick={() => setEditing(false)}>Cancel</Button>
                  <Button type="submit" variant="contained" startIcon={<SaveIcon />} disabled={save.isPending}>
                    {save.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}
        </Paper>
      )}
    </AppShell>
  );
}
