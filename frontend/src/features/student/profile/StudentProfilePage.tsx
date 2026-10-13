import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import PhoneIcon from "@mui/icons-material/PhoneOutlined";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { getMyStudentProfile } from "../../../api/students";
import { changePassword } from "../../../api/auth";
import { useAuth } from "../../../auth/AuthContext";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.25 }}>
        {value || "â€”"}
      </Typography>
    </Box>
  );
}

export function StudentProfilePage() {
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["student-me-profile"],
    queryFn: getMyStudentProfile,
  });

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const changePwMutation = useMutation({
    mutationFn: () => changePassword(currentPw, newPw),
    onSuccess: () => {
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwError("");
    },
    onError: (e: any) => setPwError(e?.response?.data?.detail || "Password change failed."),
  });

  function handlePasswordSubmit() {
    setPwError(""); setPwSuccess(false);
    if (!currentPw || !newPw || !confirmPw) { setPwError("All password fields are required."); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    changePwMutation.mutate();
  }

  const s = profileQuery.data;
  const initials = (s?.full_name || user?.full_name || "?")[0].toUpperCase();

  return (
    <AppShell navItems={studentNavItems} title="My Profile">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <PersonIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>My Profile</Typography>
            <Typography variant="body2" color="text.secondary">Your personal information and account settings</Typography>
          </Box>
        </Stack>

        {/* Profile card */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2.5} sx={{ mb: 3 }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: "primary.main", fontSize: 26, fontWeight: 700 }}>
                {initials}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>{s?.full_name || user?.full_name}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                  <Chip size="small" label="Student" color="primary" variant="outlined" />
                  {s?.admission_number && (
                    <Chip size="small" label={`#${s.admission_number}`} variant="outlined" />
                  )}
                  {s?.class_grade_id && (
                    <Chip size="small" label="Student" icon={<SchoolIcon />} variant="outlined" />
                  )}
                </Stack>
              </Box>
            </Stack>

            <Divider sx={{ mb: 2.5 }} />

            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>
              Academic Information
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <InfoRow label="Full Name" value={s?.full_name} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <InfoRow label="Admission No." value={s?.admission_number} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <InfoRow label="Roll Number" value={s?.roll_number} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <InfoRow label="Status" value={s?.status ?? null} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <InfoRow label="Date of Birth" value={s?.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <InfoRow label="Admission Date" value={s?.admission_date ? new Date(s.admission_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <InfoRow label="Email" value={s?.email || user?.email} />
              </Grid>
            </Grid>

            {(s?.admission_detail?.father_name || s?.admission_detail?.father_mobile) && (
              <>
                <Divider sx={{ mb: 2.5 }} />
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>
                  Family Information
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={6} md={3}>
                    <InfoRow label="Father's Name" value={s?.admission_detail?.father_name} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <InfoRow label="Father's Mobile" value={s?.admission_detail?.father_mobile} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <InfoRow label="Mother's Name" value={s?.admission_detail?.mother_name} />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <InfoRow label="WhatsApp" value={s?.admission_detail?.whatsapp_number} />
                  </Grid>
                  {s?.admission_detail?.current_address && (
                    <Grid item xs={12}>
                      <InfoRow label="Address" value={s?.admission_detail?.current_address} />
                    </Grid>
                  )}
                </Grid>
              </>
            )}
          </CardContent>
        </Card>

        {/* Change password */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
              <LockIcon color="action" />
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>Change Password</Typography>
                <Typography variant="caption" color="text.secondary">Use a strong password of at least 8 characters</Typography>
              </Box>
            </Stack>

            {pwSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>Password changed successfully. Use your new password next time you log in.</Alert>
            )}
            {pwError && (
              <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>
            )}

            <Stack spacing={2} sx={{ maxWidth: 400 }}>
              <TextField
                label="Current Password"
                type="password"
                size="small"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><BadgeIcon fontSize="small" color="action" /></InputAdornment> }}
                fullWidth
              />
              <TextField
                label="New Password"
                type="password"
                size="small"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon fontSize="small" color="action" /></InputAdornment> }}
                fullWidth
              />
              <TextField
                label="Confirm New Password"
                type="password"
                size="small"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                error={!!confirmPw && newPw !== confirmPw}
                helperText={confirmPw && newPw !== confirmPw ? "Passwords do not match" : ""}
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handlePasswordSubmit}
                disabled={changePwMutation.isPending}
                sx={{ alignSelf: "flex-start" }}
              >
                {changePwMutation.isPending ? "Changingâ€¦" : "Change Password"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}

