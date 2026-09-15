import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
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
import { listStudents, reactivateStudent } from "../../../api/students";

export function WithdrawalRegisterPage() {
  const queryClient = useQueryClient();
  const studentsQuery = useQuery({
    queryKey: ["students", undefined, "withdrawn"],
    queryFn: () => listStudents({ status: "withdrawn" }),
  });

  const reactivate = useMutation({
    mutationFn: (studentId: string) => reactivateStudent(studentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });

  return (
    <AppShell title="Students" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Withdrawal Register</Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          There are <strong>{studentsQuery.data?.length ?? 0}</strong> withdrawn students on record.
        </Typography>
      </Paper>

      {studentsQuery.data?.length === 0 && <Alert severity="info">No withdrawal records yet.</Alert>}

      {!!studentsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Adm. No</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Withdrawal Date</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {studentsQuery.data.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.admission_number ?? "—"}</TableCell>
                  <TableCell>{s.full_name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.withdrawal_date ?? "—"}</TableCell>
                  <TableCell>{s.withdrawal_reason ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => reactivate.mutate(s.id)} disabled={reactivate.isPending}>
                      Reactivate
                    </Button>
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
