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
  Grid,
  IconButton,
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
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  apiErrorMessage,
  createDepartment,
  createDesignation,
  deleteDepartment,
  deleteDesignation,
  listDepartments,
  listDesignations,
  updateDepartment,
  updateDesignation,
} from "../../../api/payroll";
import { adminNavWithPayroll } from "../../payrollNav";
import { PageHeader } from "./payrollShared";

type Kind = "department" | "designation";

interface EditState {
  kind: Kind;
  id: string | null;
  name: string;
  description: string;
  department_id: string;
}

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const departmentsQuery = useQuery({ queryKey: ["payroll", "departments"], queryFn: listDepartments });
  const designationsQuery = useQuery({ queryKey: ["payroll", "designations"], queryFn: listDesignations });
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payroll", "departments"] });
    queryClient.invalidateQueries({ queryKey: ["payroll", "designations"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const e = edit!;
      const description = e.description || undefined;
      if (e.kind === "department") {
        return e.id
          ? updateDepartment(e.id, { name: e.name, description: e.description || null })
          : createDepartment({ name: e.name, description });
      }
      const department_id = e.department_id || null;
      return e.id
        ? updateDesignation(e.id, { name: e.name, department_id, description: e.description || null })
        : createDesignation({ name: e.name, department_id, description });
    },
    onSuccess: () => {
      setEdit(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save.")),
  });

  const remove = useMutation({
    mutationFn: (v: { kind: Kind; id: string }) => (v.kind === "department" ? deleteDepartment(v.id) : deleteDesignation(v.id)),
    onSuccess: () => {
      setPageError(null);
      invalidate();
    },
    onError: (err) => setPageError(apiErrorMessage(err, "Could not delete.")),
  });

  const deptName = (id: string | null) => departmentsQuery.data?.find((d) => d.id === id)?.name ?? "—";

  function open(kind: Kind, item?: { id: string; name: string; description: string | null; department_id?: string | null }) {
    setError(null);
    setEdit({
      kind,
      id: item?.id ?? null,
      name: item?.name ?? "",
      description: item?.description ?? "",
      department_id: item?.department_id ?? "",
    });
  }

  return (
    <AppShell title="Payroll & Leaves" navItems={adminNavWithPayroll()}>
      <PageHeader title="Departments & Designations" />
      {pageError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPageError(null)}>{pageError}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6">Departments</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => open("department")}>
              Add department
            </Button>
          </Stack>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {departmentsQuery.data?.length === 0 && (
                  <TableRow><TableCell colSpan={3}>No departments yet.</TableCell></TableRow>
                )}
                {departmentsQuery.data?.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{d.description ?? "—"}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" aria-label="Edit" onClick={() => open("department", d)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" aria-label="Delete" color="error" onClick={() => remove.mutate({ kind: "department", id: d.id })}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6">Designations</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => open("designation")}>
              Add designation
            </Button>
          </Stack>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {designationsQuery.data?.length === 0 && (
                  <TableRow><TableCell colSpan={3}>No designations yet.</TableCell></TableRow>
                )}
                {designationsQuery.data?.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{deptName(d.department_id)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" aria-label="Edit" onClick={() => open("designation", d)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" aria-label="Delete" color="error" onClick={() => remove.mutate({ kind: "designation", id: d.id })}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>

      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {edit?.id ? "Edit" : "Add"} {edit?.kind}
        </DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogContent>
            {edit && (
              <Stack spacing={2}>
                <TextField label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required autoFocus fullWidth />
                {edit.kind === "designation" && (
                  <TextField
                    select
                    label="Department (optional)"
                    value={edit.department_id}
                    onChange={(e) => setEdit({ ...edit, department_id: e.target.value })}
                    fullWidth
                  >
                    <MenuItem value="">—</MenuItem>
                    {departmentsQuery.data?.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </TextField>
                )}
                <TextField
                  label="Description"
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  fullWidth
                />
                {error && <Alert severity="error">{error}</Alert>}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
