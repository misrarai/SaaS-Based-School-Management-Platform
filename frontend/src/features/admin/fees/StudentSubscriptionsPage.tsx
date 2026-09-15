import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Chip,
  InputAdornment,
  Link,
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
import SearchIcon from "@mui/icons-material/Search";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listSubscriptions, type InvoiceStatus, type SubscriptionEntry } from "../../../api/fees";

const EMPTY_ROWS: SubscriptionEntry[] = [];

const STATUS_COLORS: Record<InvoiceStatus, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  paid: "success",
  overdue: "error",
  waived: "default",
};

export function StudentSubscriptionsPage() {
  const [query, setQuery] = useState("");
  const subscriptionsQuery = useQuery({ queryKey: ["fees-subscriptions"], queryFn: listSubscriptions });
  const rows = subscriptionsQuery.data ?? EMPTY_ROWS;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.student_name.toLowerCase().includes(q) || r.class_grade_name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <AppShell title="Student Subscriptions" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Student Subscriptions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every active student's fee plan and where their latest bill stands.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          placeholder="Search by student or class"
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ minWidth: 280 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <Link component={RouterLink} to="/admin/fees/invoices">
          Generate / view invoices
        </Link>
      </Stack>

      {filtered.length === 0 && !subscriptionsQuery.isLoading && (
        <Alert severity="info">
          {rows.length === 0 ? "No active students with a class assigned yet." : "No students match your search."}
        </Alert>
      )}

      {filtered.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Monthly Fee</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.student_id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.student_name}</TableCell>
                  <TableCell>{r.class_grade_name}</TableCell>
                  <TableCell>{r.monthly_amount !== null ? `PKR ${r.monthly_amount.toLocaleString()}` : "No plan set"}</TableCell>
                  <TableCell>
                    {r.current_status ? (
                      <Chip size="small" label={r.current_status} color={STATUS_COLORS[r.current_status]} sx={{ textTransform: "capitalize" }} />
                    ) : (
                      <Chip size="small" label="No invoice yet" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
