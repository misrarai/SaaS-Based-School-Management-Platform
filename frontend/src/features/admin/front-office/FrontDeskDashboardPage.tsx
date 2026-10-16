import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { getFrontOfficeDashboard } from "../../../api/frontOffice";
import { FrontOfficeShell, PageHeader, StatCard, errorMessage, fmtDateTime } from "./common";

const TILES: {
  key:
    | "visitors_today"
    | "visitors_inside"
    | "enquiries_new"
    | "enquiries_follow_up_due"
    | "complaints_open"
    | "gate_passes_today"
    | "calls_today"
    | "parcels_today";
  label: string;
  to: string;
  color?: string;
}[] = [
  { key: "visitors_today", label: "Visitors today", to: "/admin/front-office/visitors", color: "#2563eb" },
  { key: "visitors_inside", label: "Currently inside", to: "/admin/front-office/visitors", color: "#059669" },
  { key: "enquiries_new", label: "New enquiries", to: "/admin/front-office/enquiries", color: "#7c3aed" },
  { key: "enquiries_follow_up_due", label: "Follow-ups due", to: "/admin/front-office/enquiries", color: "#d97706" },
  { key: "complaints_open", label: "Open complaints", to: "/admin/front-office/complaints", color: "#dc2626" },
  { key: "gate_passes_today", label: "Gate passes today", to: "/admin/front-office/gate-passes" },
  { key: "calls_today", label: "Calls today", to: "/admin/front-office/calls" },
  { key: "parcels_today", label: "Parcels today", to: "/admin/front-office/postal" },
];

export function FrontDeskDashboardPage() {
  const dashboard = useQuery({ queryKey: ["fo-dashboard"], queryFn: getFrontOfficeDashboard });

  return (
    <FrontOfficeShell title="Dashboard">
      <PageHeader title="Front Office Dashboard" />

      {dashboard.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : dashboard.isError ? (
        <Alert severity="error">{errorMessage(dashboard.error, "Could not load the dashboard.")}</Alert>
      ) : dashboard.data ? (
        <Stack spacing={3}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" },
            }}
          >
            {TILES.map((tile) => (
              <Box key={tile.label} component={RouterLink} to={tile.to} sx={{ textDecoration: "none" }}>
                <StatCard label={tile.label} value={dashboard.data[tile.key]} color={tile.color} />
              </Box>
            ))}
          </Box>

          <Box
            sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, alignItems: "start" }}
          >
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Typography variant="h6" sx={{ p: 2, pb: 1 }}>
                Today's visitors
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Visitor</TableCell>
                      <TableCell>Purpose</TableCell>
                      <TableCell>In</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboard.data.recent_visitors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ color: "text.secondary" }}>
                          No visitors yet today.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dashboard.data.recent_visitors.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>{v.visitor_name}</TableCell>
                          <TableCell>{v.purpose}</TableCell>
                          <TableCell>{fmtDateTime(v.in_time)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={v.out_time ? "Left" : "Inside"}
                              color={v.out_time ? "default" : "success"}
                              variant={v.out_time ? "outlined" : "filled"}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Typography variant="h6" sx={{ p: 2, pb: 1 }}>
                Open complaints
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>From</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboard.data.open_complaints.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ color: "text.secondary" }}>
                          No open complaints.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dashboard.data.open_complaints.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.complainant_name}</TableCell>
                          <TableCell>{c.complaint_type}</TableCell>
                          <TableCell sx={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.description}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        </Stack>
      ) : null}
    </FrontOfficeShell>
  );
}
