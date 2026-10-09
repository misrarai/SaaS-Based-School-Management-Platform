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
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { apiErrorMessage, createLeaveType, listLeaveTypes, updateLeaveType, type LeaveType } from "../../../api/payroll";
import { adminNavWithPayroll } from "../../payrollNav";
import { PageHeader } from "./payrollShared";

interface Draft {
  id: string | null;
  name: string;
  yearly_quota: string;
  is_paid: boolean;
  is_active: boolean;
}

export function LeaveTypesPage() {
  const queryClient = useQueryClient();
  const typesQuery = useQuery({ queryKey: ["payroll", "leave-types", "all"], queryFn: () => listLeaveTypes(false) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const d = draft!;
      const payload = { name: d.name, yearly_quota: Number(d.yearly_quota) || 0, is_paid: d.is_paid };
      return d.id ? updateLeaveType(d.id, { ...payload, is_active: d.is_active }) : createLeaveType(payload);
    },
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["payroll", "leave-types"] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not save leave type.")),
  });

  function open(t?: LeaveType) {
    setError(null);
    setDraft({
      id: t?.id ?? null,
      name: t?.name ?? "",
      yearly_quota: String(t?.yearly_quota ?? 0),
      is_paid: t?.is_paid ?? true,
      is_active: t?.is_active ?? true,
    });
  }

  return (
    <AppShell title="Payroll & Leaves" navItems={adminNavWithPayroll()}>
      <PageHeader
        title="Leave Types"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => open()}>Add leave type</Button>}
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        Yearly quota of 0 means unlimited. Unpaid leave days are deducted from salary at the per-day rate during payroll.
      </Alert>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Yearly quota</TableCell>
              <TableCell>Paid</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {typesQuery.data?.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.name}</TableCell>
                <TableCell align="right">{t.yearly_quota || "Unlimited"}</TableCell>
                <TableCell>
                  <Chip size="small" label={t.is_paid ? "Paid" : "Unpaid"} color={t.is_paid ? "success" : "warning"} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={t.is_active ? "Active" : "Inactive"} color={t.is_active ? "primary" : "default"} />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => open(t)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!draft} onClose={() => setDraft(null)} fullWidth maxWidth="xs">
        <DialogTitle>{draft?.id ? "Edit leave type" : "Add leave type"}</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogContent>
            {draft && (
              <Stack spacing={2}>
                <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required autoFocus fullWidth />
                <TextField
                  label="Yearly quota (days)"
                  type="number"
                  value={draft.yearly_quota}
                  onChange={(e) => setDraft({ ...draft, yearly_quota: e.target.value })}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, max: 366 } }}
                />
                <FormControlLabel
                  control={<Switch checked={draft.is_paid} onChange={(e) => setDraft({ ...draft, is_paid: e.target.checked })} />}
                  label="Paid leave"
                />
                {draft.id && (
                  <FormControlLabel
                    control={<Switch checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />}
                    label="Active"
                  />
                )}
                {error && <Alert severity="error">{error}</Alert>}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
