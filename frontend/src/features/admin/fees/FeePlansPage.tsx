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
import { listClasses } from "../../../api/classes";
import { createFeePlan, listFeePlans } from "../../../api/fees";

export function FeePlansPage() {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const plansQuery = useQuery({ queryKey: ["fee-plans"], queryFn: listFeePlans });

  const classNameById = Object.fromEntries((classesQuery.data ?? []).map((c) => [c.id, c.name]));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [classGradeId, setClassGradeId] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addPlan = useMutation({
    mutationFn: () =>
      createFeePlan({
        class_grade_id: classGradeId,
        academic_year: academicYear,
        monthly_amount: Number(monthlyAmount),
        name: name || undefined,
      }),
    onSuccess: () => {
      setDialogOpen(false);
      setClassGradeId("");
      setMonthlyAmount("");
      setName("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["fee-plans"] });
    },
    onError: () => setError("Could not create fee plan — one may already exist for this class and year."),
  });

  return (
    <AppShell title="Fee Plans" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Fee Plans</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add fee plan
        </Button>
      </Stack>

      {plansQuery.data?.length === 0 && (
        <Alert severity="info">No fee plans set yet — add one per class before generating monthly invoices.</Alert>
      )}

      {!!plansQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Class</TableCell>
                <TableCell>Academic year</TableCell>
                <TableCell>Monthly amount (PKR)</TableCell>
                <TableCell>Name</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plansQuery.data.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{classNameById[p.class_grade_id] ?? "—"}</TableCell>
                  <TableCell>{p.academic_year}</TableCell>
                  <TableCell>{p.monthly_amount.toLocaleString()}</TableCell>
                  <TableCell>{p.name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add a fee plan</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            addPlan.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <FormControl fullWidth required>
                <InputLabel id="plan-class-label">Class</InputLabel>
                <Select
                  labelId="plan-class-label"
                  label="Class"
                  value={classGradeId}
                  onChange={(e) => setClassGradeId(e.target.value)}
                >
                  {classesQuery.data?.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Academic year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Monthly amount (PKR)"
                type="number"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Name (optional)"
                placeholder="e.g. Tuition"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addPlan.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
