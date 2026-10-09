import { useState, type FormEvent } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import { useAuth } from "../auth/AuthContext";
import { shellColors } from "../theme";

const SCHOOL_CODE_KEY = "login.schoolCode";

function readSchoolCode(): string {
  try {
    return localStorage.getItem(SCHOOL_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

const FEATURES = [
  "Admissions, families & student records",
  "Fee invoicing, collection & receipts",
  "Attendance for students, teachers & staff",
  "Timetables, online classes & exams",
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const resetSuccess = !!(location.state as { resetSuccess?: boolean } | null)?.resetSuccess;
  const [tenantSlug, setTenantSlug] = useState(readSchoolCode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await login(tenantSlug.trim(), email, password);
      try {
        localStorage.setItem(SCHOOL_CODE_KEY, tenantSlug.trim());
      } catch {
        // ignore storage failures
      }
      navigate(`/${user.role}`, { replace: true });
    } catch {
      setError("Invalid school code, email, or password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default" }}>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flex: "0 0 46%",
          flexDirection: "column",
          justifyContent: "space-between",
          p: 6,
          color: "#fff",
          background: `linear-gradient(150deg, ${shellColors.sidebarBg} 0%, ${shellColors.headerDark} 55%, #0f5c6e 100%)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: "50%",
            right: -140,
            bottom: -140,
            bgcolor: "rgba(20,184,166,0.15)",
          }}
        />
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", position: "relative" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: shellColors.sidebarAccent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SchoolIcon />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>School Management System</Typography>
        </Stack>
        <Box sx={{ position: "relative" }}>
          <Typography sx={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2, mb: 2 }}>
            Run your whole school from one place.
          </Typography>
          <Stack spacing={1.25}>
            {FEATURES.map((f) => (
              <Stack key={f} direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                <CheckCircleIcon sx={{ color: shellColors.sidebarAccent }} fontSize="small" />
                <Typography sx={{ opacity: 0.9 }}>{f}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.6, position: "relative" }}>
          © {new Date().getFullYear()} School Management System
        </Typography>
      </Box>

      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 } }}>
        <Box sx={{ width: "100%", maxWidth: 400 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 3, display: { xs: "flex", md: "none" } }}>
            <SchoolIcon color="primary" sx={{ fontSize: 36 }} />
            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>School Management System</Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your school code and account details to continue.
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {resetSuccess && <Alert severity="success">Your password has been reset. Sign in with your new password.</Alert>}
              <TextField
                label="School Code"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                required
                fullWidth
                autoFocus={!tenantSlug}
                helperText="The short code your school registered with"
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoComplete="email"
                autoFocus={!!tenantSlug}
              />
              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="current-password"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting} fullWidth>
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
              <Typography variant="body2" align="right">
                <Link component={RouterLink} to="/forgot-password">
                  Forgot password?
                </Link>
              </Typography>
            </Stack>
          </Box>
          <Typography variant="body2" align="center" sx={{ mt: 4 }} color="text.secondary">
            New school?{" "}
            <Link component={RouterLink} to="/register">
              Register your school
            </Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
