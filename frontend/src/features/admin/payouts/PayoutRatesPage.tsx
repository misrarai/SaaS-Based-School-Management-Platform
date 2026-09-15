import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listTeachers } from "../../../api/teachers";
import { createPayoutRate, listPayoutRates, type PayoutRateType } from "../../../api/payouts";

export function PayoutRatesPage() {
  const queryClient = useQueryClient();
  const teachersQuery = useQuery({ queryKey: ["teachers"], queryFn: () => listTeachers() });
  const ratesQuery = useQuery({ queryKey: ["payout-rates"], queryFn: () => listPayoutRates() });
  const teacherNameById = Object.fromEntries((teachersQuery.data ?? []).map((t) => [t.id, t.full_name]));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [rateType, setRateType] = useState<PayoutRateType>("per_session");
  const [rateValue, setRateValue] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createPayoutRate({
        teacher_id: teacherId,
        rate_type: rateType,
        rate_value: Number(rateValue),
        effective_from: effectiveFrom,
      }),
    onSuccess: () => {
      setDialogOpen(false);
      setTeacherId("");
      setRateValue("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["payout-rates"] });
    },
    onError: () => setError("Could not create rate."),
  });

  return (
    <AppShell title="Payout Rates" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Payout Rates</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add rate
        </Button>
      </Stack>

      {ratesQuery.data?.length === 0 && <Alert severity="info">No payout rates set yet.</Alert>}

      {!!ratesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Teacher</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Rate</TableCell>
                <TableCell>Effective from</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ratesQuery.data.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{teacherNameById[r.teacher_id] ?? "—"}</TableCell>
                  <TableCell>{r.rate_type === "per_session" ? "Per session" : "Revenue share %"}</TableCell>
                  <TableCell>{r.rate_type === "per_session" ? `PKR ${r.rate_value}` : `${r.rate_value}%`}</TableCell>
                  <TableCell>{r.effective_from}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.is_active ? "Active" : "Inactive"} color={r.is_active ? "success" : "default"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add a payout rate</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <FormControl fullWidth required>
                <InputLabel id="teacher-label">Teacher</InputLabel>
                <Select labelId="teacher-label" label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  {teachersQuery.data?.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.full_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel id="type-label">Rate type</InputLabel>
                <Select
                  labelId="type-label"
                  label="Rate type"
                  value={rateType}
                  onChange={(e) => setRateType(e.target.value as PayoutRateType)}
                >
                  <MenuItem value="per_session">Per session (PKR per completed class)</MenuItem>
                  <MenuItem value="revenue_share_percent">Revenue share (% of verified tuition)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={rateType === "per_session" ? "Amount per session (PKR)" : "Share (%)"}
                type="number"
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Effective from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
