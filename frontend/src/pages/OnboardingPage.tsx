import { useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import { useAuth } from "../auth/AuthContext";
import { onboardSchool } from "../api/tenants";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OnboardingPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [schoolName, setSchoolName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSchoolNameChange(value: string) {
    setSchoolName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onboardSchool({
        school_name: schoolName,
        slug,
        contact_email: contactEmail,
        admin_full_name: adminFullName,
        admin_email: adminEmail,
        admin_password: adminPassword,
      });
      const user = await login(slug, adminEmail, adminPassword);
      navigate(`/${user.role}`, { replace: true });
    } catch (err) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not register the academy. The academy code may already be taken.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 480, width: "100%", boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ alignItems: "center", mb: 3 }}>
            <SchoolIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Register Your Academy
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Set up your academy's workspace in a minute.
            </Typography>
          </Stack>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Academy name"
                value={schoolName}
                onChange={(e) => handleSchoolNameChange(e.target.value)}
                required
                fullWidth
                autoFocus
              />
              <TextField
                label="Academy code (used to sign in)"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                helperText="Lowercase letters, numbers, and hyphens only"
                required
                fullWidth
              />
              <TextField
                label="Academy contact email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                fullWidth
              />

              <Divider>Your admin account</Divider>

              <TextField
                label="Your full name"
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Your email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                slotProps={{ htmlInput: { minLength: 8 } }}
                required
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting} fullWidth>
                {isSubmitting ? "Creating your academy…" : "Create academy"}
              </Button>
            </Stack>
          </Box>
          <Typography variant="body2" align="center" sx={{ mt: 3 }}>
            Already registered?{" "}
            <Link component={RouterLink} to="/login">
              Log in
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
