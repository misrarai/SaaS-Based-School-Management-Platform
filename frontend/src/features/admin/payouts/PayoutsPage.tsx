import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
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
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listTeachers } from "../../../api/teachers";
import {
  approvePayout,
  bulkGeneratePayouts,
  generatePayout,
  listPayouts,
  markPayoutPaid,
  type PayoutStatus,
} from "../../../api/payouts";

const STATUS_COLORS: Record<PayoutStatus, "warning" | "success" | "default"> = {
  draft: "default",
  approved: "warning",
  paid: "success",
};

export function PayoutsPage() {
  const queryClient = useQueryClient();
  const teachersQuery = useQuery({ queryKey: ["teachers"], queryFn: () => listTeachers() });
  const payoutsQuery = useQuery({ queryKey: ["payouts", "admin"], queryFn: listPayouts });
  const teacherNameById = Object.fromEntries((teachersQuery.data ?? []).map((t) => [t.id, t.full_name]));

  const [teacherId, setTeacherId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(String(new Date().getMonth() + 1));
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateOne = useMutation({
    mutationFn: () => generatePayout(teacherId, Number(periodMonth), Number(periodYear)),
    onSuccess: () => {
      setError(null);
      setMessage("Payout generated.");
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
    },
    onError: () => {
      setMessage(null);
      setError("Could not generate — check a rate is set for this teacher and no payout for this period is already approved/paid.");
    },
  });

  const generateAll = useMutation({
    mutationFn: () => bulkGeneratePayouts(Number(periodMonth), Number(periodYear)),
    onSuccess: (created) => {
      setError(null);
      setMessage(`Generated ${created.length} payout(s).`);
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => approvePayout(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payouts"] }),
  });
  const markPaid = useMutation({
    mutationFn: (id: string) => markPayoutPaid(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payouts"] }),
  });

  return (
    <AppShell title="Payouts" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Payouts
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="teacher-label">Teacher</InputLabel>
            <Select labelId="teacher-label" label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              {teachersQuery.data?.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.full_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Month"
            type="number"
            size="small"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            slotProps={{ htmlInput: { min: 1, max: 12 } }}
          />
          <TextField label="Year" type="number" size="small" value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} />
          <Button variant="outlined" onClick={() => generateOne.mutate()} disabled={!teacherId || generateOne.isPending}>
            Generate for teacher
          </Button>
          <Button variant="contained" onClick={() => generateAll.mutate()} disabled={generateAll.isPending}>
            Generate for all rated teachers
          </Button>
        </Stack>
        {message && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {payoutsQuery.data?.length === 0 && <Alert severity="info">No payouts generated yet.</Alert>}

      {!!payoutsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Teacher</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Sessions</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payoutsQuery.data.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{teacherNameById[p.teacher_id] ?? "—"}</TableCell>
                  <TableCell>
                    {p.period_month}/{p.period_year}
                  </TableCell>
                  <TableCell>{p.sessions_delivered}</TableCell>
                  <TableCell>PKR {p.calculated_amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.status} color={STATUS_COLORS[p.status]} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      {p.status === "draft" && (
                        <Button size="small" onClick={() => approve.mutate(p.id)} disabled={approve.isPending}>
                          Approve
                        </Button>
                      )}
                      {p.status === "approved" && (
                        <Button size="small" variant="contained" onClick={() => markPaid.mutate(p.id)} disabled={markPaid.isPending}>
                          Mark paid
                        </Button>
                      )}
                    </Stack>
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
