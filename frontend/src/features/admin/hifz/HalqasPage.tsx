import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createHalqa, listHalqas, updateHalqa, type Halqa } from "../../../api/hifz";

export function HalqasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", incharge: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const halqas = useQuery({ queryKey: ["hifz-halqas"], queryFn: listHalqas });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["hifz-halqas"] });

  const add = useMutation({
    mutationFn: () => createHalqa({ name: form.name, incharge: form.incharge || undefined, description: form.description || undefined }),
    onSuccess: () => { setOpen(false); setForm({ name: "", incharge: "", description: "" }); invalidate(); },
    onError: (e: unknown) => setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not save."),
  });
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => updateHalqa(id, { is_active: active }), onSuccess: invalidate });

  return (
    <AppShell title="Hifz — Halqas" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Halqas</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setOpen(true); }}>New Halqa</Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Name</TableCell><TableCell>In-charge</TableCell><TableCell>Description</TableCell>
            <TableCell align="right">Students</TableCell><TableCell>Active</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {halqas.isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
            ) : (halqas.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No halqas yet.</TableCell></TableRow>
            ) : halqas.data!.map((h: Halqa) => (
              <TableRow key={h.id} hover>
                <TableCell>{h.name}</TableCell>
                <TableCell>{h.incharge || "—"}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{h.description || "—"}</TableCell>
                <TableCell align="right"><Chip size="small" label={h.student_count} /></TableCell>
                <TableCell><Switch size="small" checked={h.is_active} onChange={(e) => toggle.mutate({ id: h.id, active: e.target.checked })} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Halqa</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField size="small" label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField size="small" label="In-charge (Qari/teacher)" value={form.incharge} onChange={(e) => setForm((f) => ({ ...f, incharge: e.target.value }))} />
            <TextField size="small" label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!form.name.trim() || add.isPending}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
