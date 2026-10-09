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
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
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
import DeleteIcon from "@mui/icons-material/Delete";
import LogoutIcon from "@mui/icons-material/Logout";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { checkOutVisitor, createVisitor, deleteVisitor, listVisitors } from "../../../api/frontOffice";
import { FrontOfficeShell, PageHeader, errorMessage, fmtDateTime, localInputToIso, todayIso } from "./common";

const EMPTY = { visitor_name: "", phone: "", cnic: "", purpose: "", person_to_meet: "", number_of_persons: "1", in_time: "", notes: "" };

export function VisitorsPage() {
  const queryClient = useQueryClient();
  const [day, setDay] = useState(todayIso());
  const [insideOnly, setInsideOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const visitors = useQuery({
    queryKey: ["fo-visitors", day, insideOnly, search],
    queryFn: () => listVisitors({ date: day, inside_only: insideOnly, q: search }),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fo-visitors"] });

  const add = useMutation({
    mutationFn: () =>
      createVisitor({
        visitor_name: form.visitor_name,
        phone: form.phone || null,
        cnic: form.cnic || null,
        purpose: form.purpose,
        person_to_meet: form.person_to_meet || null,
        number_of_persons: Number(form.number_of_persons) || 1,
        in_time: localInputToIso(form.in_time),
        notes: form.notes || null,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm(EMPTY);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(errorMessage(e, "Could not add visitor.")),
  });
  const checkOut = useMutation({ mutationFn: (id: string) => checkOutVisitor(id), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => deleteVisitor(id), onSuccess: invalidate });
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <FrontOfficeShell title="Visitor Book">
      <PageHeader
        title="Visitor Book"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Check in visitor
          </Button>
        }
      />
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
          <TextField size="small" type="date" label="Date" value={day} onChange={(e) => setDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField
            size="small"
            placeholder="Search name, phone or CNIC"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 300 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <FormControlLabel control={<Switch checked={insideOnly} onChange={(e) => setInsideOnly(e.target.checked)} />} label="Still inside only" />
        </Stack>
      </Paper>

      {visitors.isLoading && <Typography>Loading…</Typography>}
      {visitors.data?.length === 0 && <Alert severity="info">No visitors recorded for this date.</Alert>}
      {!!visitors.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Visitor</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>CNIC</TableCell>
                <TableCell>Purpose</TableCell>
                <TableCell>To meet</TableCell>
                <TableCell>Persons</TableCell>
                <TableCell>In</TableCell>
                <TableCell>Out</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visitors.data.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell>{v.visitor_name}</TableCell>
                  <TableCell>{v.phone ?? "—"}</TableCell>
                  <TableCell>{v.cnic ?? "—"}</TableCell>
                  <TableCell>{v.purpose}</TableCell>
                  <TableCell>{v.person_to_meet ?? "—"}</TableCell>
                  <TableCell>{v.number_of_persons}</TableCell>
                  <TableCell>{fmtDateTime(v.in_time)}</TableCell>
                  <TableCell>{v.out_time ? fmtDateTime(v.out_time) : <Chip size="small" color="warning" label="Inside" />}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {!v.out_time && (
                      <Button size="small" startIcon={<LogoutIcon fontSize="small" />} onClick={() => checkOut.mutate(v.id)}>
                        Check out
                      </Button>
                    )}
                    <IconButton size="small" color="error" onClick={() => window.confirm("Delete this entry?") && remove.mutate(v.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Check in a visitor</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Visitor name" value={form.visitor_name} onChange={(e) => set({ visitor_name: e.target.value })} required fullWidth autoFocus />
                <TextField label="Phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} fullWidth />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="CNIC" placeholder="35202-1234567-1" value={form.cnic} onChange={(e) => set({ cnic: e.target.value })} fullWidth />
                <TextField label="No. of persons" type="number" value={form.number_of_persons} onChange={(e) => set({ number_of_persons: e.target.value })} fullWidth />
              </Stack>
              <TextField label="Purpose" value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} required fullWidth />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Person to meet" value={form.person_to_meet} onChange={(e) => set({ person_to_meet: e.target.value })} fullWidth />
                <TextField label="In time (blank = now)" type="datetime-local" value={form.in_time} onChange={(e) => set({ in_time: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <TextField label="Notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} fullWidth multiline minRows={2} />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={add.isPending}>Check in</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </FrontOfficeShell>
  );
}
