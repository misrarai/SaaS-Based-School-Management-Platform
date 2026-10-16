import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  createSchoolAdmin,
  createTenant,
  listSchoolAdmins,
  listTenants,
  toggleAdminActive,
  updateTenant,
  type CreateSchoolAdminRequest,
  type CreateTenantRequest,
  type TenantOut,
} from "../../api/superAdmin";
import { SuperAdminLayout } from "./SuperAdminLayout";

const darkHead = { bgcolor: "#0b2e42", "& .MuiTableCell-head": { color: "#fff", fontWeight: 600 } };

// ── Create School Dialog ──────────────────────────────────────────────────────

function CreateSchoolDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateTenantRequest>({
    name: "",
    slug: "",
    contact_email: "",
    plan: "trial",
    admin_full_name: "",
    admin_email: "",
    admin_password: "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-stats"] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail ?? "Failed to create school");
    },
  });

  function slugify(name: string) {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create New School</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="subtitle2" color="text.secondary">School details</Typography>
          <TextField
            label="School Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
            required fullWidth
          />
          <TextField
            label="School Slug (login code)"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            required fullWidth
            helperText="Lowercase letters, numbers and hyphens only. Staff use this to log in."
          />
          <TextField
            label="Contact Email"
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
            required fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Plan</InputLabel>
            <Select value={form.plan} label="Plan" onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}>
              <MenuItem value="trial">Trial</MenuItem>
              <MenuItem value="basic">Basic</MenuItem>
              <MenuItem value="premium">Premium</MenuItem>
            </Select>
          </FormControl>

          <Divider />
          <Typography variant="subtitle2" color="text.secondary">First admin account</Typography>
          <TextField
            label="Admin Full Name"
            value={form.admin_full_name}
            onChange={(e) => setForm((f) => ({ ...f, admin_full_name: e.target.value }))}
            required fullWidth
          />
          <TextField
            label="Admin Email"
            type="email"
            value={form.admin_email}
            onChange={(e) => setForm((f) => ({ ...f, admin_email: e.target.value }))}
            required fullWidth
          />
          <TextField
            label="Admin Password"
            type="password"
            value={form.admin_password}
            onChange={(e) => setForm((f) => ({ ...f, admin_password: e.target.value }))}
            required fullWidth
            helperText="Min 8 characters"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(form)}
        >
          {mutation.isPending ? "Creating…" : "Create School"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Add Admin Dialog ──────────────────────────────────────────────────────────

function AddAdminDialog({ tenant, onClose }: { tenant: TenantOut; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateSchoolAdminRequest>({ full_name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: CreateSchoolAdminRequest) => createSchoolAdmin(tenant.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-admins", tenant.id] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail ?? "Failed to add admin");
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add Admin — {tenant.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Full Name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required fullWidth />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required fullWidth />
          <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required fullWidth helperText="Min 8 characters" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate(form)}>
          {mutation.isPending ? "Adding…" : "Add Admin"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Admins Row (expandable) ───────────────────────────────────────────────────

function AdminsRow({ tenant }: { tenant: TenantOut }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addAdminOpen, setAddAdminOpen] = useState(false);

  const admins = useQuery({
    queryKey: ["school-admins", tenant.id],
    queryFn: () => listSchoolAdmins(tenant.id),
    enabled: expanded,
  });

  const toggleMutation = useMutation({
    mutationFn: (userId: string) => toggleAdminActive(tenant.id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-admins", tenant.id] }),
  });

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Typography fontWeight={600}>{tenant.name}</Typography>
          <Typography variant="caption" color="text.secondary">{tenant.slug}</Typography>
        </TableCell>
        <TableCell>{tenant.contact_email}</TableCell>
        <TableCell>
          <Chip size="small" label={tenant.plan} variant="outlined" />
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={tenant.is_active ? "Active" : "Inactive"}
            color={tenant.is_active ? "success" : "default"}
          />
        </TableCell>
        <TableCell align="right">{tenant.admin_count}</TableCell>
        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="Add admin">
              <IconButton size="small" onClick={() => setAddAdminOpen(true)}><PersonAddIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title={expanded ? "Hide admins" : "View admins"}>
              <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
                <ExpandMoreIcon fontSize="small" sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0, bgcolor: "action.hover" }}>
            <Box sx={{ py: 1.5, px: 2 }}>
              {admins.isLoading ? (
                <CircularProgress size={20} />
              ) : (admins.data?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">No admins yet.</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {admins.data!.map((a) => (
                    <Stack key={a.id} direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>{a.full_name} — <span style={{ opacity: 0.7 }}>{a.email}</span></Typography>
                      <Chip size="small" label={a.is_active ? "Active" : "Disabled"} color={a.is_active ? "success" : "default"} />
                      <Tooltip title={a.is_active ? "Disable" : "Enable"}>
                        <IconButton size="small" onClick={() => toggleMutation.mutate(a.id)}>
                          {a.is_active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon color="disabled" />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          </TableCell>
        </TableRow>
      )}

      {addAdminOpen && <AddAdminDialog tenant={tenant} onClose={() => setAddAdminOpen(false)} />}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SchoolsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const tenants = useQuery({ queryKey: ["tenants"], queryFn: listTenants });
  const qc = useQueryClient();

  const toggleTenantMutation = useMutation({
    mutationFn: (t: TenantOut) => updateTenant(t.id, { is_active: !t.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["platform-stats"] });
    },
  });

  const schools = (tenants.data ?? []).filter((t) => t.slug !== "platform");

  return (
    <SuperAdminLayout>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Schools</Typography>
          <Typography variant="body2" color="text.secondary">Manage all registered schools on the platform.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New School
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkHead}>
            <TableRow>
              <TableCell>School</TableCell>
              <TableCell>Contact Email</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Admins</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : schools.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                  No schools yet. Click "New School" to add the first one.
                </TableCell>
              </TableRow>
            ) : (
              schools.map((t) => <AdminsRow key={t.id} tenant={t} />)
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {createOpen && <CreateSchoolDialog onClose={() => setCreateOpen(false)} />}
    </SuperAdminLayout>
  );
}
