import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthContext";

export function NotFoundPage() {
  const { user } = useAuth();
  return (
    <Box
      sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3, bgcolor: "background.default" }}
    >
      <Box sx={{ textAlign: "center", maxWidth: 420 }}>
        <Typography sx={{ fontSize: 72, fontWeight: 800, color: "primary.main", lineHeight: 1 }}>404</Typography>
        <Typography variant="h6" sx={{ mt: 1 }}>
          Page not found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          The page you are looking for does not exist or has been moved.
        </Typography>
        <Button component={RouterLink} to={user ? `/${user.role}` : "/login"} variant="contained">
          {user ? "Back to dashboard" : "Go to login"}
        </Button>
      </Box>
    </Box>
  );
}
