import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createDonation, createDonor, listDonations, listDonors } from "../../../api/hifz";

const money = (n: number) => `PKR ${n.toLocaleString()}`;

export function DonorsPage() {
  const qc = useQueryClient();
  const [donorDlg, setDonorDlg] = useState(false);
  const [donor, setDonor] = useState({ name: "", phone: "", email: "", address: "" });
  const [donDlg, setDonDlg] = useState(false);
  const [donation, setDonation] = useState({ donor_id: "", amount: "", purpose: "" });
  const [error, setError] = useState<string | null>(null);

  const donors = useQuery({ queryKey: ["hifz-donors"], queryFn: listDonors });
  const donations = useQuery({ queryKey: ["hifz-donations"], queryFn: () => listDonations() });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["hifz-donors"] }); qc.invalidateQueries({ queryKey: ["hifz-donations"] }); };

  const addDonor = useMutation({
    mutationFn: () => createDonor({ name: donor.name, phone: donor.phone || undefined, email: donor.email || undefined, address: donor.address || undefined }),
    onSuccess: () => { setDonorDlg(false); setDonor({ name: "", phone: "", email: "", address: "" }); invalidate(); },
    onError: () => setError("Could not save donor."),
  });
  const addDonation = useMutation({
    mutationFn: () => createDonation({ donor_id: donation.donor_id, amount: Number(donation.amount), purpose: donation.purpose || undefined }),
    onSuccess: () => { setDonDlg(false); setDonation({ donor_id: "", amount: "", purpose: "" }); invalidate(); },
    onError: () => setError("Could not record donation."),
  });

  return (
    <AppShell title="Hifz — Donors" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Donors & Donations</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { setError(null); setDonation({ donor_id: donors.data?.[0]?.id ?? "", amount: "", purpose: "" }); setDonDlg(true); }}>Record Donation</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setDonorDlg(true); }}>New Donor</Button>
        </Stack>
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>Donors</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow><TableCell>Name</TableCell><TableCell>Phone</TableCell><TableCell align="right">Total donated</TableCell><TableCell align="right">Sponsorships</TableCell></TableRow></TableHead>
          <TableBody>
            {(donors.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>No donors yet.</TableCell></TableRow>
            ) : donors.data!.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>{d.name}</TableCell><TableCell>{d.phone || "—"}</TableCell>
                <TableCell align="right">{money(d.total_donated)}</TableCell>
                <TableCell align="right">{d.active_sponsorships > 0 ? <Chip size="small" color="success" label={d.active_sponsorships} /> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1 }}>Donations</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow><TableCell>Date</TableCell><TableCell>Donor</TableCell><TableCell>Purpose</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
          <TableBody>
            {(donations.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>No donations recorded.</TableCell></TableRow>
            ) : donations.data!.map((x) => (
              <TableRow key={x.id} hover>
                <TableCell>{x.donation_date}</TableCell><TableCell>{x.donor_name}</TableCell><TableCell>{x.purpose || "—"}</TableCell>
                <TableCell align="right">{money(x.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={donorDlg} onClose={() => setDonorDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Donor</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField size="small" label="Name" value={donor.name} onChange={(e) => setDonor((d) => ({ ...d, name: e.target.value }))} />
            <TextField size="small" label="Phone" value={donor.phone} onChange={(e) => setDonor((d) => ({ ...d, phone: e.target.value }))} />
            <TextField size="small" label="Email" value={donor.email} onChange={(e) => setDonor((d) => ({ ...d, email: e.target.value }))} />
            <TextField size="small" label="Address" value={donor.address} onChange={(e) => setDonor((d) => ({ ...d, address: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDonorDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => addDonor.mutate()} disabled={!donor.name.trim() || addDonor.isPending}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={donDlg} onClose={() => setDonDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>Record Donation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select size="small" label="Donor" value={donation.donor_id} onChange={(e) => setDonation((d) => ({ ...d, donor_id: e.target.value }))}>
              {(donors.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
            <TextField size="small" type="number" label="Amount" value={donation.amount} onChange={(e) => setDonation((d) => ({ ...d, amount: e.target.value }))} />
            <TextField size="small" label="Purpose" value={donation.purpose} onChange={(e) => setDonation((d) => ({ ...d, purpose: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDonDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => addDonation.mutate()} disabled={!donation.donor_id || !donation.amount || addDonation.isPending}>Record</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
