import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  Typography,
} from "@mui/material";
import SmsIcon from "@mui/icons-material/Sms";
import SendIcon from "@mui/icons-material/Send";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listDefaulters, sendDefaulterReminders } from "../../../api/feeCollection";

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

export function SendSMSPage() {
  const [monthsOverdue, setMonthsOverdue] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ students_reminded: number; notifications_logged: number } | null>(null);

  const defaultersQuery = useQuery({
    queryKey: ["defaulters-sms", monthsOverdue],
    queryFn: () => listDefaulters({ months_overdue: monthsOverdue }),
  });

  const defaulters = defaultersQuery.data ?? [];

  const allSelected = defaulters.length > 0 && defaulters.every((d) => selected.has(d.student_id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(defaulters.map((d) => d.student_id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const sendMutation = useMutation({
    mutationFn: () =>
      sendDefaulterReminders({ student_ids: Array.from(selected) }),
    onSuccess: (data) => {
      setResult(data);
      setSelected(new Set());
    },
  });

  return (
    <AppShell title="Send SMS" navItems={adminNavItems}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SmsIcon color="primary" />
          <Typography variant="h4">Send SMS Reminders</Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<SendIcon />}
          disabled={!someSelected || sendMutation.isPending}
          onClick={() => sendMutation.mutate()}
        >
          Send to {selected.size} Student{selected.size !== 1 ? "s" : ""}
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Send fee reminder SMS to parents of students who have overdue fee challans.
        Select students below, then click "Send".
      </Typography>

      {result && (
        <Alert
          severity="success"
          onClose={() => setResult(null)}
          sx={{ mb: 2 }}
        >
          Reminders sent to <strong>{result.students_reminded}</strong> student(s) — <strong>{result.notifications_logged}</strong> notification(s) logged.
        </Alert>
      )}

      {sendMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to send reminders. Please try again.</Alert>
      )}

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <WarningAmberIcon color="warning" />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Overdue By At Least</InputLabel>
            <Select
              value={monthsOverdue}
              label="Overdue By At Least"
              onChange={(e) => {
                setMonthsOverdue(Number(e.target.value));
                setSelected(new Set());
              }}
            >
              <MenuItem value={1}>1 Month</MenuItem>
              <MenuItem value={2}>2 Months</MenuItem>
              <MenuItem value={3}>3 Months</MenuItem>
              <MenuItem value={6}>6 Months</MenuItem>
            </Select>
          </FormControl>
          {defaulters.length > 0 && (
            <Chip label={`${defaulters.length} defaulters`} color="error" size="small" />
          )}
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={toggleAll}
                  sx={{ color: "white" }}
                />
              </TableCell>
              <TableCell>Student</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Adm #</TableCell>
              <TableCell>Parent Phone</TableCell>
              <TableCell align="right">Overdue Months</TableCell>
              <TableCell align="right">Overdue Balance</TableCell>
              <TableCell>Oldest Due</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {defaultersQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography py={2} color="text.secondary">Loading…</Typography>
                </TableCell>
              </TableRow>
            )}
            {!defaultersQuery.isLoading && defaulters.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Box py={4}>
                    <Typography color="text.secondary">
                      No defaulters found with {monthsOverdue}+ month(s) overdue.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {defaulters.map((d) => (
              <TableRow
                key={d.student_id}
                hover
                selected={selected.has(d.student_id)}
                sx={{ cursor: "pointer" }}
                onClick={() => toggle(d.student_id)}
              >
                <TableCell padding="checkbox">
                  <Checkbox checked={selected.has(d.student_id)} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{d.student_name}</TableCell>
                <TableCell>{d.class_grade_name ?? "—"}</TableCell>
                <TableCell>{d.admission_number ?? "—"}</TableCell>
                <TableCell>{d.family_number ?? "—"}</TableCell>
                <TableCell align="right">
                  <Chip label={`${d.months_overdue}m`} size="small" color="error" />
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>
                  {fmt(d.overdue_balance)}
                </TableCell>
                <TableCell>{d.oldest_due_date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {someSelected && (
        <Paper sx={{ p: 2, mt: 2, borderRadius: 2, bgcolor: "primary.50" }} variant="outlined">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">
              <strong>{selected.size}</strong> student{selected.size !== 1 ? "s" : ""} selected —
              total overdue:{" "}
              <strong>
                {fmt(
                  defaulters
                    .filter((d) => selected.has(d.student_id))
                    .reduce((s, d) => s + d.overdue_balance, 0)
                )}
              </strong>
            </Typography>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? "Sending…" : "Send SMS"}
            </Button>
          </Stack>
        </Paper>
      )}
    </AppShell>
  );
}
