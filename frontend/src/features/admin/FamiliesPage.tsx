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
import { createFamily, listFamilies } from "../../api/families";

export function FamiliesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const familiesQuery = useQuery({ queryKey: ["families", search], queryFn: () => listFamilies(search || undefined) });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addFamily = useMutation({
    mutationFn: () =>
      createFamily({
        family_name: familyName,
        cnic: cnic || undefined,
        phone: phone || undefined,
        whatsapp_number: whatsapp || undefined,
      }),
    onSuccess: () => {
      setFamilyName("");
      setCnic("");
      setPhone("");
      setWhatsapp("");
      setError(null);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["families"] });
    },
    onError: () => setError("Could not create family."),
  });

  return (
    <AppShell title="Families" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Families</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add family
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Search by name, CNIC, phone, or family number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 360 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          There are <strong>{familiesQuery.data?.length ?? 0}</strong> families registered.
        </Typography>
      </Paper>

      {familiesQuery.isLoading && <Typography>Loading…</Typography>}
      {familiesQuery.data?.length === 0 && (
        <Alert severity="info">No families yet — click "Add family" to create the first household record.</Alert>
      )}

      {!!familiesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Family No.</TableCell>
                <TableCell>Family Name</TableCell>
                <TableCell>CNIC</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>WhatsApp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {familiesQuery.data.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell>{f.family_number}</TableCell>
                  <TableCell>{f.family_name}</TableCell>
                  <TableCell>{f.cnic ?? "—"}</TableCell>
                  <TableCell>{f.phone ?? "—"}</TableCell>
                  <TableCell>{f.whatsapp_number ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add a family</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            addFamily.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Family name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
                autoFocus
                fullWidth
              />
              <TextField label="CNIC" value={cnic} onChange={(e) => setCnic(e.target.value)} fullWidth />
              <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
              <TextField
                label="WhatsApp number"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addFamily.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
