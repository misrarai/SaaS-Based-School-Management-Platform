import { useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  InputAdornment,
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
import SearchIcon from "@mui/icons-material/Search";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";
import { darkTableHeadSx } from "../../components/tableStyles";
import { createStaff, listStaff, setStaffStatus } from "../../api/staff";

type StatusTab = "active" | "inactive";

const TAB_LABELS: Record<StatusTab, string> = {
  active: "Active Staff",
  inactive: "Old Staff",
};

const VALID_STATUS_TABS: StatusTab[] = ["active", "inactive"];

export function StaffPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [statusTab, setStatusTab] = useState<StatusTab>(
    VALID_STATUS_TABS.includes(initialStatus as StatusTab) ? (initialStatus as StatusTab) : "active",
  );
  const [search, setSearch] = useState("");

  function handleTabChange(next: StatusTab) {
    setStatusTab(next);
    setSearchParams({ status: next });
  }
  const staffQuery = useQuery({
    queryKey: ["staff", statusTab, search],
    queryFn: () => listStaff({ status: statusTab, query: search || undefined }),
  });

  const toggleStatus = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "inactive" }) => setStaffStatus(vars.id, vars.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [salary, setSalary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addStaff = useMutation({
    mutationFn: () =>
      createStaff({
        full_name: fullName,
        designation,
        phone: phone || undefined,
        whatsapp_number: whatsapp || undefined,
        salary: salary ? Number(salary) : undefined,
      }),
    onSuccess: () => {
      setFullName("");
      setDesignation("");
      setPhone("");
      setWhatsapp("");
      setSalary("");
      setError(null);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: () => setError("Could not add staff member."),
  });

  return (
    <AppShell title="HR / Staff" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Staff</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add staff
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        {(Object.keys(TAB_LABELS) as StatusTab[]).map((key) => {
          const selected = key === statusTab;
          return (
            <Button
              key={key}
              onClick={() => handleTabChange(key)}
              variant={selected ? "contained" : "outlined"}
              size="small"
              sx={{
                borderRadius: 1,
                bgcolor: selected ? "#0e3550" : "#fff",
                color: selected ? "#fff" : "text.primary",
                borderColor: "#d0d5dd",
                "&:hover": { bgcolor: selected ? "#0e3550" : "#f5f5f5", borderColor: "#d0d5dd" },
              }}
            >
              {TAB_LABELS[key]}
            </Button>
          );
        })}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Search by name or designation"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 320 }}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          There are <strong>{staffQuery.data?.length ?? 0}</strong> staff members in this view.
        </Typography>
      </Paper>

      {staffQuery.isLoading && <Typography>Loading…</Typography>}
      {staffQuery.data?.length === 0 && (
        <Alert severity="info">
          {statusTab === "active" ? 'No active staff — click "Add staff" to register the first employee.' : "No records here."}
        </Alert>
      )}

      {!!staffQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Comp.</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Salary</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staffQuery.data.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.employee_code}</TableCell>
                  <TableCell>{s.full_name}</TableCell>
                  <TableCell>{s.designation}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{s.salary != null ? s.salary.toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status} color={s.status === "active" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">
                    {s.status === "active" ? (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => toggleStatus.mutate({ id: s.id, status: "inactive" })}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button size="small" onClick={() => toggleStatus.mutate({ id: s.id, status: "active" })}>
                        Reactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add a staff member</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            addStaff.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                fullWidth
              />
              <TextField
                label="Designation"
                placeholder="e.g. Principal, Accountant, Peon"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                required
                fullWidth
              />
              <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
              <TextField
                label="WhatsApp number"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                fullWidth
              />
              <TextField
                label="Salary (optional)"
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addStaff.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
