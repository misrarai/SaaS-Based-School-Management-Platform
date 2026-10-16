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
  IconButton,
  InputAdornment,
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
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/EditOutlined";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";
import { darkTableHeadSx } from "../../components/tableStyles";
import { createTeacher, listTeachers, setTeacherActive, type Teacher } from "../../api/teachers";
import { EditTeacherDialog } from "./EditDialogs";

export function TeachersPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");

  const teachersQuery = useQuery({
    queryKey: ["teachers", appliedSearch, statusFilter],
    queryFn: () =>
      listTeachers(
        appliedSearch || undefined,
        statusFilter === "" ? undefined : statusFilter === "true",
      ),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [qualification, setQualification] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  function resetCreateForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setEmployeeCode("");
    setHireDate("");
    setQualification("");
    setCreateError(null);
  }

  const addTeacher = useMutation({
    mutationFn: () =>
      createTeacher({
        full_name: fullName,
        email,
        password,
        phone_number: phone.trim() || undefined,
        employee_code: employeeCode.trim() || undefined,
        hire_date: hireDate || undefined,
        qualification: qualification.trim() || undefined,
      }),
    onSuccess: () => {
      resetCreateForm();
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: () => setCreateError("Could not create teacher. Email may already be in use."),
  });

  const toggleActive = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) => setTeacherActive(vars.id, vars.isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teachers"] }),
  });

  return (
    <AppShell title="Teachers" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Teachers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add teacher
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Search by name, email, employee ID or qualification"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(searchInput)}
            sx={{ minWidth: 320 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | "true" | "false")}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Inactive</MenuItem>
          </TextField>
          <Button variant="contained" color="success" onClick={() => setAppliedSearch(searchInput)}>
            Search
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          There are <strong>{teachersQuery.data?.length ?? 0}</strong> teacher(s) matching current filters.
        </Typography>
      </Paper>

      {teachersQuery.isLoading && <Typography>Loading…</Typography>}
      {!teachersQuery.isLoading && teachersQuery.data?.length === 0 && (
        <Alert severity="info">No teachers found. Try adjusting filters or click "Add teacher".</Alert>
      )}

      {!!teachersQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Employee ID</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Qualification</TableCell>
                <TableCell>Joining Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teachersQuery.data.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{t.full_name}</TableCell>
                  <TableCell>{t.employee_code ?? "—"}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>{t.phone_number ?? "—"}</TableCell>
                  <TableCell>{t.qualification ?? "—"}</TableCell>
                  <TableCell>{t.hire_date ?? "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t.is_active ? "Active" : "Inactive"}
                      color={t.is_active ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditingTeacher(t)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        color={t.is_active ? "error" : "success"}
                        onClick={() => toggleActive.mutate({ id: t.id, isActive: !t.is_active })}
                      >
                        {t.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {editingTeacher && (
        <EditTeacherDialog
          teacher={editingTeacher}
          onClose={() => setEditingTeacher(null)}
        />
      )}

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); resetCreateForm(); }} fullWidth maxWidth="sm">
        <DialogTitle>Add a teacher</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            addTeacher.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                  fullWidth
                />
                <TextField
                  label="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Temporary password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Employee code (optional)"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Joining date (optional)"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>
              <TextField
                label="Qualification (optional)"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                fullWidth
              />
              {createError && <Alert severity="error">{createError}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => { setDialogOpen(false); resetCreateForm(); }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addTeacher.isPending}>
              {addTeacher.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
