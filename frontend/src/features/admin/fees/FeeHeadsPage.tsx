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
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  listFeeHeads,
  createFeeHead,
  updateFeeHead,
  deleteFeeHead,
  seedDefaultFeeHeads,
  type FeeHead,
  type FeeFrequency,
} from "../../../api/feeCollection";

const FREQ_LABELS: Record<FeeFrequency, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUALLY: "Annual",
  ONE_TIME: "One-Time",
};

const EMPTY = { name: "", code: "", default_frequency: "MONTHLY" as FeeFrequency, description: "" };

export function FeeHeadsPage() {
  const qc = useQueryClient();
  const headsQuery = useQuery({ queryKey: ["fee-heads"], queryFn: () => listFeeHeads() });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeeHead | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeHead | null>(null);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      editing
        ? updateFeeHead(editing.id, {
            name: form.name,
            code: form.code || undefined,
            default_frequency: form.default_frequency,
            description: form.description || undefined,
          })
        : createFeeHead({
            name: form.name,
            code: form.code || undefined,
            default_frequency: form.default_frequency,
            description: form.description || undefined,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-heads"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setError(null);
    },
    onError: () => setError("Failed to save fee head."),
  });

  const toggleActive = useMutation({
    mutationFn: (head: FeeHead) => updateFeeHead(head.id, { is_active: !head.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-heads"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFeeHead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee-heads"] }); setDeleteTarget(null); },
    onError: () => setError("Cannot delete — this fee head may be in use."),
  });

  const seed = useMutation({
    mutationFn: seedDefaultFeeHeads,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-heads"] }),
  });

  const openEdit = (head: FeeHead) => {
    setEditing(head);
    setForm({ name: head.name, code: head.code ?? "", default_frequency: head.default_frequency, description: head.description ?? "" });
    setDialogOpen(true);
    setError(null);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
    setError(null);
  };

  const heads = headsQuery.data ?? [];

  return (
    <AppShell title="Fee Heads" navItems={adminNavItems}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Fee Heads</Typography>
        <Stack direction="row" spacing={1}>
          {heads.length === 0 && (
            <Button
              variant="outlined"
              startIcon={<AutoFixHighIcon />}
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
            >
              Seed Defaults
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Add Fee Head
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Fee heads define the categories of charges (e.g. Tuition Fee, Transport, Annual Fund).
        You can rename, reorder and activate/deactivate them.
      </Typography>

      {heads.length === 0 && !headsQuery.isLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No fee heads yet. Click "Seed Defaults" to add standard heads, or add your own.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Default Frequency</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {heads.map((h) => (
              <TableRow key={h.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{h.name}</TableCell>
                <TableCell>
                  {h.code ? <Chip label={h.code} size="small" variant="outlined" /> : "—"}
                </TableCell>
                <TableCell>{FREQ_LABELS[h.default_frequency]}</TableCell>
                <TableCell>{h.description ?? "—"}</TableCell>
                <TableCell>
                  <Switch
                    checked={h.is_active}
                    size="small"
                    onChange={() => toggleActive.mutate(h)}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(h)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(h)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Fee Head" : "Add Fee Head"}</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required fullWidth placeholder="e.g. Tuition Fee" />
              <TextField label="Code (optional)" value={form.code} onChange={(e) => set("code", e.target.value)} fullWidth placeholder="e.g. TF" />
              <FormControl fullWidth>
                <InputLabel>Default Frequency</InputLabel>
                <Select value={form.default_frequency} label="Default Frequency" onChange={(e) => set("default_frequency", e.target.value as FeeFrequency)}>
                  {Object.entries(FREQ_LABELS).map(([k, v]) => (
                    <MenuItem key={k} value={k}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Description (optional)" value={form.description} onChange={(e) => set("description", e.target.value)} fullWidth multiline minRows={2} />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>Delete Fee Head</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            This cannot be undone if it's in use by fee structures.
          </Typography>
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => remove.mutate(deleteTarget!.id)} disabled={remove.isPending}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
