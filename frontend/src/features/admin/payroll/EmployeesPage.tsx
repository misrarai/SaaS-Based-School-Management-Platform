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
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  apiErrorMessage,
  listDepartments,
  listDesignations,
  listEmployees,
  money,
  saveEmployeeProfile,
  type Employee,
  type EmployeeProfilePayload,
  type EmploymentType,
} from "../../../api/payroll";
import { adminNavWithPayroll } from "../../payrollNav";
import { EmployeeTypeChip, PageHeader } from "./payrollShared";

type StatusTab = "active" | "inactive" | "all";

const EMPTY_FORM: Required<EmployeeProfilePayload> = {
  cnic: "",
  date_of_birth: "",
  gender: "",
  address: "",
  qualification: "",
  joining_date: "",
  bank_name: "",
  bank_account_no: "",
  department_id: "",
  designation_id: "",
  employment_type: "permanent",
  contract_start: "",
  contract_end: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relation: "",
};

type FormState = typeof EMPTY_FORM;

function toForm(e: Employee): FormState {
  const p = e.profile;
  if (!p) return { ...EMPTY_FORM };
  const out = { ...EMPTY_FORM };
  (Object.keys(EMPTY_FORM) as (keyof FormState)[]).forEach((k) => {
    const v = p[k];
    (out as Record<string, unknown>)[k] = v ?? (k === "employment_type" ? "permanent" : "");
  });
  return out;
}

function toPayload(f: FormState): EmployeeProfilePayload {
  const out: Record<string, unknown> = {};
  (Object.keys(f) as (keyof FormState)[]).forEach((k) => {
    out[k] = f[k] === "" ? null : f[k];
  });
  return out as EmployeeProfilePayload;
}

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["payroll", "employees", statusTab, search],
    queryFn: () => listEmployees({ status: statusTab, q: search }),
  });
  const departmentsQuery = useQuery({ queryKey: ["payroll", "departments"], queryFn: listDepartments });
  const designationsQuery = useQuery({ queryKey: ["payroll", "designations"], queryFn: listDesignations });

  const save = useMutation({
    mutationFn: () => saveEmployeeProfile(editing!.employee_type, editing!.employee_id, toPayload(form)),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["payroll", "employees"] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not save HR profile.")),
  });

  function openEdit(e: Employee) {
    setEditing(e);
    setForm(toForm(e));
    setError(null);
  }

  const set = (k: keyof FormState) => (ev: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: ev.target.value }));
  const field = (k: keyof FormState, label: string, type = "text", extra: object = {}) => (
    <Grid size={{ xs: 12, sm: 6 }}>
      <TextField
        label={label}
        type={type}
        value={form[k] ?? ""}
        onChange={set(k)}
        fullWidth
        size="small"
        slotProps={type === "date" ? { inputLabel: { shrink: true } } : undefined}
        {...extra}
      />
    </Grid>
  );

  return (
    <AppShell title="Payroll & Leaves" navItems={adminNavWithPayroll()}>
      <PageHeader title="Employees" />

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        {(["active", "inactive", "all"] as StatusTab[]).map((key) => (
          <Button
            key={key}
            size="small"
            variant={key === statusTab ? "contained" : "outlined"}
            onClick={() => setStatusTab(key)}
            sx={{ textTransform: "capitalize" }}
          >
            {key}
          </Button>
        ))}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name, code or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320, maxWidth: "100%" }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
          }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Teachers and non-teaching staff in one list. <strong>{employeesQuery.data?.length ?? 0}</strong> employees shown.
        </Typography>
      </Paper>

      {employeesQuery.isLoading && <Typography>Loading…</Typography>}
      {employeesQuery.data?.length === 0 && <Alert severity="info">No employees in this view.</Alert>}

      {!!employeesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Employment</TableCell>
                <TableCell>CNIC</TableCell>
                <TableCell>Joining</TableCell>
                <TableCell align="right">Gross Salary</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employeesQuery.data.map((e) => (
                <TableRow key={`${e.employee_type}:${e.employee_id}`} hover>
                  <TableCell>{e.employee_code ?? "—"}</TableCell>
                  <TableCell>{e.full_name}</TableCell>
                  <TableCell><EmployeeTypeChip type={e.employee_type} /></TableCell>
                  <TableCell>{e.department_name ?? "—"}</TableCell>
                  <TableCell>{e.designation_name ?? "—"}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{e.profile?.employment_type ?? "—"}</TableCell>
                  <TableCell>{e.profile?.cnic ?? "—"}</TableCell>
                  <TableCell>{e.profile?.joining_date ?? "—"}</TableCell>
                  <TableCell align="right">{money(e.current_gross_salary)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(e)}>
                      {e.profile ? "Edit HR profile" : "Add HR profile"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle>HR profile — {editing?.full_name}</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Personal</Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {field("cnic", "CNIC", "text", { placeholder: "35202-1234567-1" })}
              {field("date_of_birth", "Date of birth", "date")}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select label="Gender" value={form.gender ?? ""} onChange={set("gender")} fullWidth size="small">
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              </Grid>
              {field("qualification", "Qualification")}
              <Grid size={12}>
                <TextField label="Address" value={form.address ?? ""} onChange={set("address")} fullWidth size="small" multiline minRows={2} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Employment</Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select label="Department" value={form.department_id ?? ""} onChange={set("department_id")} fullWidth size="small">
                  <MenuItem value="">—</MenuItem>
                  {departmentsQuery.data?.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select label="Designation" value={form.designation_id ?? ""} onChange={set("designation_id")} fullWidth size="small">
                  <MenuItem value="">—</MenuItem>
                  {designationsQuery.data?.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Employment type"
                  value={form.employment_type}
                  onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value as EmploymentType }))}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="permanent">Permanent</MenuItem>
                  <MenuItem value="contract">Contract</MenuItem>
                  <MenuItem value="visiting">Visiting</MenuItem>
                </TextField>
              </Grid>
              {field("joining_date", "Joining date", "date")}
              {form.employment_type !== "permanent" && field("contract_start", "Contract start", "date")}
              {form.employment_type !== "permanent" && field("contract_end", "Contract end", "date")}
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Bank & emergency contact</Typography>
            <Grid container spacing={2}>
              {field("bank_name", "Bank name")}
              {field("bank_account_no", "Account no. / IBAN")}
              {field("emergency_contact_name", "Emergency contact name")}
              {field("emergency_contact_phone", "Emergency contact phone")}
              {field("emergency_contact_relation", "Relation")}
            </Grid>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
