import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardContent, Grid, Skeleton, Typography } from "@mui/material";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlined";
import { getPlatformStats } from "../../api/superAdmin";
import { SuperAdminLayout } from "./SuperAdminLayout";
import { useAuth } from "../../auth/AuthContext";

function StatCard({ label, value, icon, color }: { label: string; value: number | undefined; icon: React.ReactNode; color: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>
            {value !== undefined ? value : <Skeleton width={40} />}
          </Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export function SuperAdminDashboard() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ["platform-stats"], queryFn: getPlatformStats });

  return (
    <SuperAdminLayout>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Welcome, {user?.full_name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Platform overview — manage all schools from here.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <StatCard label="Total Schools" value={stats.data?.total_schools} icon={<SchoolIcon />} color="#0b2e42" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Active Schools" value={stats.data?.active_schools} icon={<CheckCircleIcon />} color="#14b8a6" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Total Users" value={stats.data?.total_users} icon={<PeopleIcon />} color="#7c3aed" />
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Quick links</Typography>
          <Typography variant="body2" color="text.secondary">
            Use the <strong>Schools</strong> section in the sidebar to create new schools, manage school admins, and enable or disable access.
          </Typography>
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
