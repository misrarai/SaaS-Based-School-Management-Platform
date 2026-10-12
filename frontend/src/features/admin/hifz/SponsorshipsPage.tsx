import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Autocomplete, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createSponsorship, listDonors, listSponsorships, updateSponsorship } from "../../../api/hifz";
import { listStudents, type Student } from "../../../api/students";

const money = (n: number) => `PKR ${n.toLocaleString()}`;

export function SponsorshipsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [donorId, setDonorId] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sponsorships = useQuery({ queryKey: ["hifz-sponsorships"], queryFn: () => listSponsorships() });
  const donors = useQuery({ queryKey: ["hifz-donors"], queryFn: listDonors });
  const students = useQuery({ queryKey: ["students-active"], queryFn: () => listStudents({ status: "active" }) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["hifz-sponsorships"] }); qc.invalidateQueries({ queryKey: ["hifz-donors"] }); };

  const add = useMutation({
    mutationFn: () => createSponsorship({ donor_id: donorId, student_id: student!.id, monthly_amount: Number(amount) }),
    onSuccess: () => { setOpen(false); setStudent(null); setAmount(""); invalidate(); },
    onError: (e: unknown) => setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not create sponsorship."),
  });
  const end = useMutation({ mutationFn: (id: string) => updateSponsorship(id, { status: "ended" }), onSuccess: invalidate });

  const total = (sponsorships.data ?? []).filter((s) => s.status === "active").reduce((sum, s) => sum + s.monthly_amount, 0);

  return (
    <AppShell title="Hifz — Sponsorships" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Sponsorships</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setDonorId(donors.data?.[0]?.id ?? ""); setOpen(true); }}>New Sponsorship</Button>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>Active monthly sponsorship commitment: <strong>{money(total)}</strong></Alert>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Student</TableCell><TableCell>Donor</TableCell><TableCell align="right">Monthly</TableCell>
            <TableCell>Since</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {sponsorships.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : (sponsorships.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No sponsorships yet.</TableCell></TableRow>
            ) : sponsorships.data!.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{s.student_name}</TableCell>
                <TableCell>{s.donor_name}</TableCell>
                <TableCell align="right">{money(s.monthly_amount)}</TableCell>
                <TableCell>{s.start_date}</TableCell>
                <TableCell><Chip size="small" color={s.status === "active" ? "success" : "default"} label={s.status} /></TableCell>
                <TableCell align="right">{s.status === "active" && <Button size="small" color="warning" onClick={() => end.mutate(s.id)}>End</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Sponsorship</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select size="small" label="Donor" value={donorId} onChange={(e) => setDonorId(e.target.value)}>
              {(donors.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
            <Autocomplete
              options={students.data ?? []} getOptionLabel={(s) => `${s.full_name}${s.admission_number ? ` (${s.admission_number})` : ""}`}
              value={student} onChange={(_, v) => setStudent(v)}
              renderInput={(params) => <TextField {...params} size="small" label="Student" />}
            />
            <TextField size="small" type="number" label="Monthly amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => add.mutate()} disabled={!donorId || !student || !amount || add.isPending}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
