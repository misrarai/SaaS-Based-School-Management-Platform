import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import SecurityIcon from "@mui/icons-material/Security";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listConcessions } from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

export function SecurityFeePage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const concessionsQuery = useQuery({
    queryKey: ["security-concessions"],
    queryFn: () => listConcessions(),
  });

  const concessions = (concessionsQuery.data ?? []).filter((c) => {
    const matchesSearch =
      !search || c.student_name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || c.concession_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalSecurityDeposits = concessions
    .filter((c) => c.concession_type === "FIXED")
    .reduce((s, c) => s + c.value, 0);

  const totalPercentageConcessions = concessions
    .filter((c) => c.concession_type === "PERCENTAGE")
    .reduce((s, c) => s + c.value, 0);

  return (
    <AppShell title="Security Fee" navItems={adminNavItems}>
      <Stack direction="row" spacing={1} alignItems="center" mb={3}>
        <SecurityIcon color="primary" />
        <Typography variant="h4">Security Fee &amp; Concessions</Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        View security deposits and fee concessions granted to students. These are applied
        automatically when generating monthly challans.
      </Typography>

      {/* Summary */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">Security Deposits (Fixed)</Typography>
          <Typography variant="h5" fontWeight={700} color="primary.main">
            {fmt(totalSecurityDeposits)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {concessions.filter((c) => c.concession_type === "FIXED").length} students
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">Percentage Concessions</Typography>
          <Typography variant="h5" fontWeight={700} color="success.main">
            {fmt(totalPercentageConcessions)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {concessions.filter((c) => c.concession_type === "PERCENTAGE").length} students
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary">Total Records</Typography>
          <Typography variant="h5" fontWeight={700}>{concessions.length}</Typography>
        </Paper>
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder="Search student name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="FIXED">Fixed (Security Deposit)</MenuItem>
              <MenuItem value="PERCENTAGE">Percentage Concession</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Student</TableCell>
              <TableCell>Adm #</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Fee Head</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Reason / Note</TableCell>
              <TableCell>Valid From</TableCell>
              <TableCell>Valid To</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {concessionsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography py={2} color="text.secondary">Loading…</Typography>
                </TableCell>
              </TableRow>
            )}
            {!concessionsQuery.isLoading && concessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Box py={4}>
                    <Typography color="text.secondary">
                      No security deposits or concessions found.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Concessions are added per student via the student fee settings.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {concessions.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{c.student_name}</TableCell>
                <TableCell>—</TableCell>
                <TableCell>—</TableCell>
                <TableCell>{c.fee_head_name ?? "All Heads"}</TableCell>
                <TableCell>
                  <Chip
                    label={c.concession_type === "FIXED" ? "Fixed" : "Percentage"}
                    size="small"
                    color={c.concession_type === "FIXED" ? "primary" : "success"}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {c.concession_type === "FIXED" ? fmt(c.value) : `${c.value}%`}
                </TableCell>
                <TableCell>{c.reason ?? "—"}</TableCell>
                <TableCell>{c.valid_from ?? "—"}</TableCell>
                <TableCell>{c.valid_to ?? "No Expiry"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </AppShell>
  );
}
