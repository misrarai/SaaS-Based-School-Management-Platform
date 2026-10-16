import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  MenuItem,
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
  TextField,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { adminNavItems } from "../adminNav";
import {
  getFineReport,
  getMostIssuedReport,
  getOverdueReport,
  libraryErrorMessage,
  settleLibraryFine,
} from "../../../api/library";
import { IssuesTable, StatTile, formatMoney, libraryAdminNav, withLibraryNav } from "../../libraryShared";

const navItems = withLibraryNav(adminNavItems, libraryAdminNav);

type FineFilter = "" | "unpaid" | "paid" | "waived";

export function LibraryOverdueFinesPage() {
  const [tab, setTab] = useState(0);
  return (
    <AppShell title="Library" navItems={navItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Overdue & Fines
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Overdue books" />
        <Tab label="Fines" />
        <Tab label="Most issued" />
      </Tabs>
      {tab === 0 && <OverduePanel />}
      {tab === 1 && <FinesPanel />}
      {tab === 2 && <MostIssuedPanel />}
    </AppShell>
  );
}

function OverduePanel() {
  const query = useQuery({ queryKey: ["library", "overdue"], queryFn: getOverdueReport });
  const totalAccrued = (query.data ?? []).reduce((sum, i) => sum + i.fine_amount, 0);
  return (
    <>
      <Stack direction="row" sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}>
        <StatTile label="Overdue books" value={query.data?.length ?? 0} tone="error.main" />
        <StatTile label="Fines accruing" value={formatMoney(totalAccrued)} />
      </Stack>
      {query.isLoading ? (
        <Typography>Loading…</Typography>
      ) : (
        <IssuesTable issues={query.data ?? []} emptyText="Nothing is overdue." />
      )}
    </>
  );
}

function FinesPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FineFilter>("unpaid");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["library", "fines", status, dateFrom, dateTo],
    queryFn: () => getFineReport({ status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });
  const settle = useMutation({
    mutationFn: (vars: { id: string; action: "paid" | "waived" }) => settleLibraryFine(vars.id, vars.action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
    onError: (err) => setError(libraryErrorMessage(err, "Could not update fine.")),
  });
  const report = query.data;

  return (
    <>
      {report && (
        <Stack direction="row" sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}>
          <StatTile label="Collected" value={formatMoney(report.total_collected)} tone="success.main" />
          <StatTile label="Waived" value={formatMoney(report.total_waived)} />
          <StatTile label="Outstanding" value={formatMoney(report.total_outstanding)} tone="error.main" />
        </Stack>
      )}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            select
            size="small"
            label="Fine status"
            value={status}
            onChange={(e) => setStatus(e.target.value as FineFilter)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="unpaid">Unpaid</MenuItem>
            <MenuItem value="paid">Collected</MenuItem>
            <MenuItem value="waived">Waived</MenuItem>
            <MenuItem value="">All</MenuItem>
          </TextField>
          <TextField
            label="Settled from"
            type="date"
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Settled to"
            type="date"
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          The date range applies to collected and waived fines. Fines on books still out are shown under Overdue.
        </Typography>
      </Paper>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {query.isLoading ? (
        <Typography>Loading…</Typography>
      ) : (
        <IssuesTable
          issues={report?.items ?? []}
          emptyText="No fines in this view."
          actions={(i) =>
            i.fine_status === "unpaid" ? (
              <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                <Button size="small" variant="contained" onClick={() => settle.mutate({ id: i.id, action: "paid" })}>
                  Collect
                </Button>
                <Button size="small" onClick={() => settle.mutate({ id: i.id, action: "waived" })}>
                  Waive
                </Button>
              </Stack>
            ) : null
          }
        />
      )}
    </>
  );
}

function MostIssuedPanel() {
  const query = useQuery({ queryKey: ["library", "most-issued"], queryFn: () => getMostIssuedReport(20) });
  if (query.isLoading) return <Typography>Loading…</Typography>;
  if (!query.data?.length) return <Alert severity="info">No books have been issued yet.</Alert>;
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead sx={darkTableHeadSx}>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Author</TableCell>
            <TableCell align="right">Times issued</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {query.data.map((b, idx) => (
            <TableRow key={b.book_id} hover>
              <TableCell>{idx + 1}</TableCell>
              <TableCell>{b.title}</TableCell>
              <TableCell>{b.author ?? "—"}</TableCell>
              <TableCell align="right">{b.issue_count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
