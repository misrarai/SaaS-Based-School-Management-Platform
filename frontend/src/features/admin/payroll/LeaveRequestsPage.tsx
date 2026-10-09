import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  apiErrorMessage,
  approveLeave,
  createLeaveRequest,
  getLeaveBalances,
  listLeaveRequests,
  listLeaveTypes,
  rejectLeave,
  type Employee,
  type LeaveRequest,
  type LeaveStatus,
} from "../../../api/payroll";
import { adminNavWithPayroll } from "../../payrollNav";
import { EmployeeSelect, EmployeeTypeChip, LeaveStatusChip, PageHeader } from "./payrollShared";

type Tab = LeaveStatus | "all";
const TABS: Tab[] = ["pending", "approved", "rejected", "cancelled", "all"];

export function LeaveRequestsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [pageError, setPageError] = useState<string | null>(null);
  const requestsQuery = useQuery({
    queryKey: ["payroll", "leaves", tab],
    queryFn: () => listLeaveRequests(tab === "all" ? undefined : { status: tab }),
  });
  const typesQuery = useQuery({ queryKey: ["payroll", "leave-types", "active"], queryFn: () => listLeaveTypes(true) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payroll", "leaves"] });

  const approve = useMutation({
    mutationFn: (id: string) => approveLeave(id),
    onSuccess: () => {
      setPageError(null);
      invalidate();
    },
    onError: (e) => setPageError(apiErrorMessage(e, "Could not approve leave.")),
  });

  // reject dialog
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const reject = useMutation({
    mutationFn: () => rejectLeave(rejecting!.id, rejectNote),
    onSuccess: () => {
      setRejecting(null);
      invalidate();
    },
    onError: (e) => setPageError(apiErrorMessage(e, "Could not reject leave.")),
  });

  // apply-on-behalf dialog
  const [applyOpen, setApplyOpen] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const balanceYear = fromDate ? Number(fromDate.slice(0, 4)) : new Date().getFullYear();
  const balancesQuery = useQuery({
    queryKey: ["payroll", "leave-balances", employee?.employee_type, employee?.employee_id, balanceYear],
    queryFn: () => getLeaveBalances(employee!.employee_type, employee!.employee_id, balanceYear),
    enabled: !!employee && applyOpen,
  });

  const apply = useMutation({
    mutationFn: () =>
      createLeaveRequest({
        employee_type: employee!.employee_type,
        employee_id: employee!.employee_id,
        leave_type_id: leaveTypeId,
        from_date: fromDate,
        to_date: toDate,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      setApplyOpen(false);
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (e) => setApplyError(apiErrorMessage(e, "Could not submit leave request.")),
  });

  function openApply() {
    setEmployee(null);
    setLeaveTypeId("");
    setFromDate("");
    setToDate("");
    setReason("");
    setApplyError(null);
    setApplyOpen(true);
  }

  return (
    <AppShell title="Payroll & Leaves" navItems={adminNavWithPayroll()}>
      <PageHeader
        title="Leave Requests"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={openApply}>Apply on behalf</Button>}
      />
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        {TABS.map((t) => (
          <Button key={t} size="small" variant={t === tab ? "contained" : "outlined"} onClick={() => setTab(t)} sx={{ textTransform: "capitalize" }}>
            {t}
          </Button>
        ))}
      </Stack>
      {pageError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPageError(null)}>{pageError}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Approving a request marks the employee's attendance as Leave for every date in the range.
      </Typography>

      {requestsQuery.isLoading && <Typography>Loading…</Typography>}
      {requestsQuery.data?.length === 0 && <Alert severity="info">No leave requests here.</Alert>}
      {!!requestsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Leave</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell align="right">Days</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Decided by</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requestsQuery.data.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.employee_name}</TableCell>
                  <TableCell><EmployeeTypeChip type={r.employee_type} /></TableCell>
                  <TableCell>{r.leave_type_name}</TableCell>
                  <TableCell>{r.from_date}</TableCell>
                  <TableCell>{r.to_date}</TableCell>
                  <TableCell align="right">{r.days}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>{r.reason ?? "—"}</TableCell>
                  <TableCell><LeaveStatusChip status={r.status} /></TableCell>
                  <TableCell>
                    {r.approver_name ?? "—"}
                    {r.decision_note && <Typography variant="caption" sx={{ display: "block" }} color="text.secondary">{r.decision_note}</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {r.status === "pending" && (
                      <>
                        <Button size="small" color="success" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>
                          Approve
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setRejecting(r);
                            setRejectNote("");
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reject leave — {rejecting?.employee_name}</DialogTitle>
        <DialogContent>
          <TextField label="Reason (optional)" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} fullWidth sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejecting(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={reject.isPending} onClick={() => reject.mutate()}>Reject</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={applyOpen} onClose={() => setApplyOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Apply leave on behalf of an employee</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!employee) {
              setApplyError("Select an employee.");
              return;
            }
            apply.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <EmployeeSelect value={employee} onChange={setEmployee} required />
              <TextField select label="Leave type" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required fullWidth>
                {typesQuery.data?.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name} {t.is_paid ? "" : "(unpaid)"}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2} />
              {!!balancesQuery.data?.length && (
                <Alert severity="info" icon={false}>
                  <strong>{balanceYear} balances:</strong>{" "}
                  {balancesQuery.data
                    .map((b) => `${b.leave_type_name}: ${b.remaining == null ? `${b.used} used` : `${b.remaining} left`}`)
                    .join(" · ")}
                </Alert>
              )}
              {applyError && <Alert severity="error">{applyError}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={apply.isPending}>Submit</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
