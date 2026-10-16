import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
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
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listExams } from "../../../api/exams";

function Tile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: "1 1 150px", minWidth: 150 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box sx={{ fontSize: 28, fontWeight: 700, color: color ?? "text.primary" }}>{value}</Box>
    </Paper>
  );
}

export function ExamDashboardPage() {
  const exams = useQuery({ queryKey: ["exams"], queryFn: listExams });
  const list = exams.data ?? [];
  const published = list.filter((e) => e.status === "published").length;
  const resultsOut = list.filter((e) => e.results_published).length;

  return (
    <AppShell title="Examination — Dashboard" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">Examination Dashboard</Typography>
        <Button component={RouterLink} to="/admin/exams" variant="contained">Manage Exams</Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Tile label="Total exams" value={list.length} color="#2563eb" />
        <Tile label="Draft" value={list.length - published} />
        <Tile label="Published" value={published} color="#059669" />
        <Tile label="Results released" value={resultsOut} color="#7c3aed" />
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>All exams</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Exam</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell>Classes</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Results</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exams.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : list.length === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No exams yet. Create one from Manage Exams.</TableCell></TableRow>
            ) : (
              list.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>{e.academic_year || "—"}</TableCell>
                  <TableCell>{e.start_date || "—"}{e.end_date ? ` → ${e.end_date}` : ""}</TableCell>
                  <TableCell>{e.classes.map((c) => c.class_name).join(", ") || "—"}</TableCell>
                  <TableCell><Chip size="small" color={e.status === "published" ? "success" : "default"} label={e.status} /></TableCell>
                  <TableCell>{e.results_published ? <Chip size="small" color="primary" label="Released" /> : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </AppShell>
  );
}
