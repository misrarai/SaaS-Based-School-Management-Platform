import { useQuery } from "@tanstack/react-query";
import { Box, Typography } from "@mui/material";
import {
  getFrontOfficeDashboard,
  listAppointments,
  listLostFound,
} from "../../../api/frontOffice";
import { FrontOfficeShell, PageHeader, StatCard } from "./common";

export function FrontDeskReportsPage() {
  const dash = useQuery({ queryKey: ["fo-dashboard"], queryFn: getFrontOfficeDashboard });
  const appts = useQuery({ queryKey: ["fo-appointments", "all"], queryFn: () => listAppointments() });
  const scheduled = useQuery({ queryKey: ["fo-appointments", "scheduled"], queryFn: () => listAppointments({ status: "scheduled" }) });
  const lostfound = useQuery({ queryKey: ["fo-lostfound", "all"], queryFn: () => listLostFound() });
  const openLf = useQuery({ queryKey: ["fo-lostfound", "open"], queryFn: () => listLostFound({ status: "open" }) });

  const d = dash.data;
  const tiles: { label: string; value: number | string; color?: string }[] = [
    { label: "Visitors today", value: d?.visitors_today ?? "—", color: "#2563eb" },
    { label: "Currently inside", value: d?.visitors_inside ?? "—", color: "#059669" },
    { label: "New enquiries", value: d?.enquiries_new ?? "—", color: "#7c3aed" },
    { label: "Total enquiries", value: d?.enquiries_total ?? "—" },
    { label: "Open complaints", value: d?.complaints_open ?? "—", color: "#dc2626" },
    { label: "Total complaints", value: d?.complaints_total ?? "—" },
    { label: "Gate passes today", value: d?.gate_passes_today ?? "—" },
    { label: "Calls today", value: d?.calls_today ?? "—" },
    { label: "Parcels today", value: d?.parcels_today ?? "—" },
    { label: "Appointments (scheduled)", value: scheduled.data?.length ?? "—", color: "#d97706" },
    { label: "Appointments (all)", value: appts.data?.length ?? "—" },
    { label: "Lost & found (open)", value: openLf.data?.length ?? "—", color: "#dc2626" },
    { label: "Lost & found (all)", value: lostfound.data?.length ?? "—" },
  ];

  return (
    <FrontOfficeShell title="Reports">
      <PageHeader title="Front Desk Reports" />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A roll-up across every front-desk register.
      </Typography>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" } }}>
        {tiles.map((t) => <StatCard key={t.label} label={t.label} value={t.value} color={t.color} />)}
      </Box>
    </FrontOfficeShell>
  );
}
