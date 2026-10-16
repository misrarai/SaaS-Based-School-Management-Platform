import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Chip,
  Collapse,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { getExpiringDocuments, getRouteStrength, type ExpiringDocumentRow } from "../../../api/transport";
import { adminNavWithTransportHostel } from "../../transportHostelNav";
import { PageHeader, TabButtons, fmtDate } from "../../transportHostelUi";

const KIND_LABELS: Record<ExpiringDocumentRow["kind"], string> = {
  vehicle_insurance: "Vehicle insurance",
  vehicle_fitness: "Vehicle fitness",
  driver_license: "Driver license",
};

function RouteStrength() {
  const report = useQuery({ queryKey: ["transport", "reports", "strength"], queryFn: getRouteStrength });
  const [expanded, setExpanded] = useState<string | null>(null);
  if (report.isLoading) return <Typography>Loading…</Typography>;
  if (!report.data?.length) return <Alert severity="info">No routes yet.</Alert>;
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead sx={darkTableHeadSx}>
          <TableRow>
            <TableCell>Route</TableCell>
            <TableCell>Vehicle</TableCell>
            <TableCell>Students</TableCell>
            <TableCell sx={{ width: 220 }}>Seat usage</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {report.data.map((r) => {
            const pct = r.capacity ? Math.min(100, Math.round((r.student_count * 100) / r.capacity)) : 0;
            return [
              <TableRow key={r.route_id} hover sx={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === r.route_id ? null : r.route_id)}>
                <TableCell sx={{ fontWeight: 600 }}>{r.route_name}</TableCell>
                <TableCell>{r.vehicle_registration ?? "—"}</TableCell>
                <TableCell>
                  {r.student_count}
                  {r.capacity != null && ` / ${r.capacity}`}
                </TableCell>
                <TableCell>
                  {r.capacity != null ? (
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 8, borderRadius: 4 }} color={pct >= 100 ? "error" : "primary"} />
                      <Typography variant="caption">{pct}%</Typography>
                    </Stack>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>,
              <TableRow key={`${r.route_id}-detail`}>
                <TableCell colSpan={4} sx={{ p: 0, borderBottom: expanded === r.route_id ? undefined : "none" }}>
                  <Collapse in={expanded === r.route_id} unmountOnExit>
                    <Box sx={{ p: 2, bgcolor: "#fafafa" }}>
                      {r.students.length === 0 ? (
                        <Typography variant="body2">No students on this route.</Typography>
                      ) : (
                        r.students.map((s) => (
                          <Typography key={s.id} variant="body2">
                            {s.student_name} — {s.stop_name} ({s.pickup_type})
                          </Typography>
                        ))
                      )}
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>,
            ];
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ExpiringDocuments() {
  const [days, setDays] = useState(30);
  const report = useQuery({ queryKey: ["transport", "reports", "expiring", days], queryFn: () => getExpiringDocuments(days) });
  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField size="small" type="number" label="Within days" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 30))} sx={{ width: 140 }} />
      </Paper>
      {report.isLoading && <Typography>Loading…</Typography>}
      {report.data?.length === 0 && <Alert severity="success">No documents expiring in the next {days} days.</Alert>}
      {!!report.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Document</TableCell>
                <TableCell>Vehicle / Driver</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell>Days left</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.data.map((r) => (
                <TableRow key={`${r.kind}-${r.reference_id}`} hover>
                  <TableCell>{KIND_LABELS[r.kind]}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{r.label}</TableCell>
                  <TableCell>{fmtDate(r.expiry_date)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.days_left < 0 ? `Expired ${-r.days_left}d ago` : `${r.days_left} days`} color={r.days_left < 0 ? "error" : "warning"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}

export function TransportReportsPage() {
  const [tab, setTab] = useState<"strength" | "expiring">("strength");
  return (
    <AppShell title="Transport" navItems={adminNavWithTransportHostel()}>
      <PageHeader title="Transport Reports" />
      <TabButtons
        value={tab}
        onChange={setTab}
        options={[
          { value: "strength", label: "Students per route" },
          { value: "expiring", label: "Expiring documents" },
        ]}
      />
      {tab === "strength" ? <RouteStrength /> : <ExpiringDocuments />}
    </AppShell>
  );
}
