import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { getFineReport, getLibrarySummary, getMostIssuedReport, getOverdueReport } from "../../../api/library";
import { StatTile, formatMoney } from "../../libraryShared";

export function LibraryReportsPage() {
  const [tab, setTab] = useState(0);
  const summary = useQuery({ queryKey: ["library", "summary"], queryFn: getLibrarySummary });
  const overdue = useQuery({ queryKey: ["library", "overdue"], queryFn: getOverdueReport });
  const fines = useQuery({ queryKey: ["library", "fines-report"], queryFn: () => getFineReport() });
  const popular = useQuery({ queryKey: ["library", "most-issued-20"], queryFn: () => getMostIssuedReport(20) });
  const s = summary.data;

  return (
    <AppShell title="Library — Reports" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>Library Reports</Typography>

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2, mb: 3 }}>
        <StatTile label="Titles" value={s?.total_titles ?? "—"} />
        <StatTile label="Copies" value={s?.total_copies ?? "—"} />
        <StatTile label="Overdue" value={s?.overdue_count ?? "—"} tone="#dc2626" />
        <StatTile label="Fines collected" value={fines.data ? formatMoney(fines.data.total_collected) : "—"} tone="#059669" />
        <StatTile label="Fines outstanding" value={fines.data ? formatMoney(fines.data.total_outstanding) : "—"} tone="#dc2626" />
        <StatTile label="Fines waived" value={fines.data ? formatMoney(fines.data.total_waived) : "—"} />
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tab label={`Overdue (${overdue.data?.length ?? 0})`} />
          <Tab label="Fines" />
          <Tab label="Most issued" />
        </Tabs>

        {tab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Book</TableCell><TableCell>Borrower</TableCell><TableCell>Due</TableCell>
                  <TableCell align="right">Days overdue</TableCell><TableCell align="right">Fine</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(overdue.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>Nothing overdue.</TableCell></TableRow>
                ) : overdue.data!.map((i) => (
                  <TableRow key={i.id} hover>
                    <TableCell>{i.book_title}</TableCell><TableCell>{i.member_name}</TableCell><TableCell>{i.due_date}</TableCell>
                    <TableCell align="right">{i.days_overdue}</TableCell><TableCell align="right">{formatMoney(i.fine_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 1 && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Book</TableCell><TableCell>Borrower</TableCell><TableCell>Returned</TableCell>
                  <TableCell align="right">Fine</TableCell><TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(fines.data?.items.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No fines recorded.</TableCell></TableRow>
                ) : fines.data!.items.map((i) => (
                  <TableRow key={i.id} hover>
                    <TableCell>{i.book_title}</TableCell><TableCell>{i.member_name}</TableCell><TableCell>{i.returned_on || "—"}</TableCell>
                    <TableCell align="right">{formatMoney(i.fine_amount)}</TableCell><TableCell>{i.fine_status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 2 && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow><TableCell>Title</TableCell><TableCell>Author</TableCell><TableCell align="right">Loans</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {(popular.data?.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={3} sx={{ color: "text.secondary" }}>No loans yet.</TableCell></TableRow>
                ) : popular.data!.map((b) => (
                  <TableRow key={b.book_id} hover><TableCell>{b.title}</TableCell><TableCell>{b.author || "—"}</TableCell><TableCell align="right">{b.issue_count}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      <Box sx={{ height: 24 }} />
    </AppShell>
  );
}
