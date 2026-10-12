import { useQuery } from "@tanstack/react-query";
import {
  Box,
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
import { getLibrarySummary, getOverdueReport, getMostIssuedReport } from "../../../api/library";
import { StatTile, formatMoney } from "../../libraryShared";

export function LibraryDashboardPage() {
  const summary = useQuery({ queryKey: ["library", "summary"], queryFn: getLibrarySummary });
  const overdue = useQuery({ queryKey: ["library", "overdue"], queryFn: getOverdueReport });
  const popular = useQuery({ queryKey: ["library", "most-issued"], queryFn: () => getMostIssuedReport(8) });
  const s = summary.data;

  return (
    <AppShell title="Library — Dashboard" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>Library Dashboard</Typography>

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2, mb: 3 }}>
        <StatTile label="Titles" value={s?.total_titles ?? "—"} tone="#2563eb" />
        <StatTile label="Copies" value={s?.total_copies ?? "—"} />
        <StatTile label="Available" value={s?.available_copies ?? "—"} tone="#059669" />
        <StatTile label="Issued" value={s?.issued_copies ?? "—"} tone="#7c3aed" />
        <StatTile label="Overdue" value={s?.overdue_count ?? "—"} tone="#dc2626" />
        <StatTile label="Reservations" value={s?.pending_reservations ?? "—"} tone="#d97706" />
        <StatTile label="Members" value={s?.total_members ?? "—"} />
        <StatTile label="Outstanding fines" value={s ? formatMoney(s.outstanding_fines) : "—"} tone="#dc2626" />
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "3fr 2fr" }, alignItems: "start" }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Typography variant="h6" sx={{ p: 2, pb: 1 }}>Overdue books</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Book</TableCell>
                  <TableCell>Borrower</TableCell>
                  <TableCell align="right">Days</TableCell>
                  <TableCell align="right">Fine</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(overdue.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>Nothing overdue. 🎉</TableCell></TableRow>
                ) : (
                  overdue.data!.map((i) => (
                    <TableRow key={i.id} hover>
                      <TableCell>{i.book_title}</TableCell>
                      <TableCell>{i.member_name}</TableCell>
                      <TableCell align="right">{i.days_overdue}</TableCell>
                      <TableCell align="right">{formatMoney(i.fine_amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Typography variant="h6" sx={{ p: 2, pb: 1 }}>Most issued</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell align="right">Loans</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(popular.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={2} sx={{ color: "text.secondary" }}>No loans yet.</TableCell></TableRow>
                ) : (
                  popular.data!.map((b) => (
                    <TableRow key={b.book_id} hover>
                      <TableCell>{b.title}</TableCell>
                      <TableCell align="right">{b.issue_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </AppShell>
  );
}
