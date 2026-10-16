import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { apiErrorMessage } from "../../../lib/apiError";
import { listStudents, type Student } from "../../../api/students";
import {
  createHostelAllocation,
  listHostelAllocations,
  listHostels,
  listRooms,
  vacateHostelAllocation,
  type HostelAllocation,
} from "../../../api/hostel";
import { adminNavWithTransportHostel } from "../../transportHostelNav";
import { PageHeader, TabButtons, fmtDate, fmtMoney, orNull, todayIso } from "../../transportHostelUi";
import { MonthlyFeesPanel } from "../transport/TransportFeesPage";

type Tab = "active" | "vacated" | "all" | "fees";

export function HostelAllocationsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("active");
  const [hostelFilter, setHostelFilter] = useState("");
  const hostels = useQuery({ queryKey: ["hostel", "hostels"], queryFn: listHostels });
  const rooms = useQuery({ queryKey: ["hostel", "rooms"], queryFn: () => listRooms() });
  const allocations = useQuery({
    queryKey: ["hostel", "allocations", tab, hostelFilter],
    queryFn: () => listHostelAllocations({ status: tab === "fees" ? "active" : tab, hostelId: hostelFilter || undefined }),
    enabled: tab !== "fees",
  });

  const [open, setOpen] = useState(false);
  const students = useQuery({
    queryKey: ["students", "active-for-hostel"],
    queryFn: () => listStudents({ status: "active" }),
    enabled: open,
  });
  const [student, setStudent] = useState<Student | null>(null);
  const [hostelId, setHostelId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [bed, setBed] = useState("");
  const [fromDate, setFromDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [vacating, setVacating] = useState<HostelAllocation | null>(null);
  const [vacateDate, setVacateDate] = useState(todayIso());

  const hostelRooms = useMemo(
    () => rooms.data?.filter((r) => r.hostel_id === hostelId && r.status === "active") ?? [],
    [rooms.data, hostelId],
  );

  function openDialog() {
    setStudent(null);
    setHostelId("");
    setRoomId("");
    setBed("");
    setFromDate(todayIso());
    setNotes("");
    setError(null);
    setOpen(true);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["hostel"] });

  const create = useMutation({
    mutationFn: () =>
      createHostelAllocation({ student_id: student!.id, room_id: roomId, bed_label: orNull(bed), from_date: fromDate, notes: orNull(notes) }),
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not allocate room.")),
  });

  const vacate = useMutation({
    mutationFn: () => vacateHostelAllocation(vacating!.id, vacateDate),
    onSuccess: () => {
      setVacating(null);
      invalidate();
    },
    onError: (err) => window.alert(apiErrorMessage(err, "Could not vacate.")),
  });

  return (
    <AppShell title="Hostel" navItems={adminNavWithTransportHostel()}>
      <PageHeader
        title="Hostel Allocations"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>
            Allocate room
          </Button>
        }
      />
      <TabButtons<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: "Current residents" },
          { value: "vacated", label: "Vacated" },
          { value: "all", label: "All" },
          { value: "fees", label: "Hostel Fees" },
        ]}
      />

      {tab === "fees" ? (
        <MonthlyFeesPanel kind="hostel" />
      ) : (
        <>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <TextField select size="small" label="Hostel" value={hostelFilter} onChange={(e) => setHostelFilter(e.target.value)} sx={{ minWidth: 220 }}>
                <MenuItem value="">All hostels</MenuItem>
                {hostels.data?.map((h) => (
                  <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                ))}
              </TextField>
              <Typography variant="body2" color="text.secondary">
                <strong>{allocations.data?.length ?? 0}</strong> record(s)
              </Typography>
            </Stack>
          </Paper>
          {allocations.isLoading && <Typography>Loading…</Typography>}
          {allocations.data?.length === 0 && <Alert severity="info">No allocations in this view.</Alert>}
          {!!allocations.data?.length && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={darkTableHeadSx}>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Hostel</TableCell>
                    <TableCell>Room</TableCell>
                    <TableCell>Bed</TableCell>
                    <TableCell>Fee</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allocations.data.map((a) => (
                    <TableRow key={a.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{a.student_name ?? "—"}</TableCell>
                      <TableCell>{a.hostel_name}</TableCell>
                      <TableCell>{a.room_number}</TableCell>
                      <TableCell>{a.bed_label ?? "—"}</TableCell>
                      <TableCell>{fmtMoney(a.monthly_fee)}</TableCell>
                      <TableCell>{fmtDate(a.from_date)}</TableCell>
                      <TableCell>{fmtDate(a.to_date)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={a.status} color={a.status === "active" ? "success" : "default"} />
                      </TableCell>
                      <TableCell align="right">
                        {a.status === "active" && (
                          <Button size="small" color="error" onClick={() => { setVacateDate(todayIso()); setVacating(a); }}>
                            Vacate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Allocate a hostel room</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!student) {
              setError("Select a student.");
              return;
            }
            create.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <Autocomplete
                options={students.data ?? []}
                loading={students.isLoading}
                value={student}
                onChange={(_, v) => setStudent(v)}
                getOptionLabel={(s) => `${s.full_name}${s.admission_number ? ` (#${s.admission_number})` : ""}`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => <TextField {...params} label="Student" required />}
              />
              <TextField select label="Hostel" value={hostelId} onChange={(e) => { setHostelId(e.target.value); setRoomId(""); }} required fullWidth>
                {hostels.data?.filter((h) => h.status === "active").map((h) => (
                  <MenuItem key={h.id} value={h.id}>{h.name} ({h.hostel_type})</MenuItem>
                ))}
              </TextField>
              <TextField select label="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)} required fullWidth disabled={!hostelId}>
                {hostelRooms.map((r) => (
                  <MenuItem key={r.id} value={r.id} disabled={r.available === 0}>
                    Room {r.room_number} · {r.available} of {r.capacity} beds free · {fmtMoney(r.monthly_fee)}/month
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Bed (optional)" placeholder="e.g. A, B, 1" value={bed} onChange={(e) => setBed(e.target.value)} fullWidth />
                <TextField label="From date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
              <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>Allocate</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={vacating !== null} onClose={() => setVacating(null)} fullWidth maxWidth="xs">
        <DialogTitle>Vacate room</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {vacating?.student_name} — {vacating?.hostel_name}, room {vacating?.room_number}
          </Typography>
          <TextField label="Vacate date" type="date" value={vacateDate} onChange={(e) => setVacateDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVacating(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => vacate.mutate()} disabled={vacate.isPending}>Vacate</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
