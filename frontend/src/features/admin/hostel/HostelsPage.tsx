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
import {
  createHostel,
  createRoom,
  deleteHostel,
  deleteRoom,
  listHostels,
  listRooms,
  updateHostel,
  updateRoom,
  type Hostel,
  type HostelRoom,
  type HostelType,
} from "../../../api/hostel";
import { adminNavWithTransportHostel } from "../../transportHostelNav";
import { PageHeader, fmtMoney, orNull } from "../../transportHostelUi";

const EMPTY_HOSTEL = { name: "", hostel_type: "boys" as HostelType, warden_name: "", warden_phone: "", address: "", status: "active" as Hostel["status"] };
const EMPTY_ROOM = { room_number: "", floor: "", room_type: "", capacity: "", monthly_fee: "", status: "active" as HostelRoom["status"] };

function HostelDialog({ hostel, open, onClose }: { hostel: Hostel | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_HOSTEL);
  const [error, setError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = `${open}-${hostel?.id ?? "new"}`;
  if (key !== lastKey) {
    setLastKey(key);
    setError(null);
    setForm(
      hostel
        ? {
            name: hostel.name,
            hostel_type: hostel.hostel_type,
            warden_name: hostel.warden_name ?? "",
            warden_phone: hostel.warden_phone ?? "",
            address: hostel.address ?? "",
            status: hostel.status,
          }
        : EMPTY_HOSTEL,
    );
  }
  const set = (k: keyof typeof EMPTY_HOSTEL) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        hostel_type: form.hostel_type,
        warden_name: orNull(form.warden_name),
        warden_phone: orNull(form.warden_phone),
        address: orNull(form.address),
      };
      return hostel ? updateHostel(hostel.id, { ...payload, status: form.status }) : createHostel(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel"] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save hostel.")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{hostel ? "Edit hostel" : "Add a hostel"}</DialogTitle>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <DialogContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Hostel name" value={form.name} onChange={set("name")} required fullWidth autoFocus />
              <TextField select label="Type" value={form.hostel_type} onChange={set("hostel_type")} sx={{ minWidth: 140 }}>
                <MenuItem value="boys">Boys</MenuItem>
                <MenuItem value="girls">Girls</MenuItem>
                <MenuItem value="mixed">Mixed</MenuItem>
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Warden name" value={form.warden_name} onChange={set("warden_name")} fullWidth />
              <TextField label="Warden phone" value={form.warden_phone} onChange={set("warden_phone")} fullWidth />
            </Stack>
            <TextField label="Address" value={form.address} onChange={set("address")} fullWidth multiline minRows={2} />
            {hostel && (
              <TextField select label="Status" value={form.status} onChange={set("status")} fullWidth>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>{hostel ? "Save" : "Create"}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function RoomDialog({ hostelId, room, onClose }: { hostelId: string | null; room: HostelRoom | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_ROOM);
  const [error, setError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = `${hostelId}-${room?.id ?? "new"}`;
  if (key !== lastKey) {
    setLastKey(key);
    setError(null);
    setForm(
      room
        ? {
            room_number: room.room_number,
            floor: room.floor ?? "",
            room_type: room.room_type ?? "",
            capacity: String(room.capacity),
            monthly_fee: String(room.monthly_fee),
            status: room.status,
          }
        : EMPTY_ROOM,
    );
  }
  const set = (k: keyof typeof EMPTY_ROOM) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        room_number: form.room_number.trim(),
        floor: orNull(form.floor),
        room_type: orNull(form.room_type),
        capacity: Number(form.capacity),
        monthly_fee: Number(form.monthly_fee) || 0,
      };
      return room ? updateRoom(room.id, { ...payload, status: form.status }) : createRoom(hostelId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel"] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not save room.")),
  });

  return (
    <Dialog open={hostelId !== null} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{room ? `Edit room ${room.room_number}` : "Add a room"}</DialogTitle>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <DialogContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField label="Room number" value={form.room_number} onChange={set("room_number")} required fullWidth autoFocus />
              <TextField label="Floor" value={form.floor} onChange={set("floor")} fullWidth />
            </Stack>
            <TextField label="Room type" placeholder="e.g. Single, Double, Dormitory" value={form.room_type} onChange={set("room_type")} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField label="Beds" type="number" value={form.capacity} onChange={set("capacity")} required fullWidth />
              <TextField label="Monthly fee (Rs)" type="number" value={form.monthly_fee} onChange={set("monthly_fee")} fullWidth />
            </Stack>
            {room && (
              <TextField select label="Status" value={form.status} onChange={set("status")} fullWidth>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>Save</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function HostelsPage() {
  const queryClient = useQueryClient();
  const hostels = useQuery({ queryKey: ["hostel", "hostels"], queryFn: listHostels });
  const rooms = useQuery({ queryKey: ["hostel", "rooms"], queryFn: () => listRooms() });
  const [hostelDialog, setHostelDialog] = useState<{ open: boolean; hostel: Hostel | null }>({ open: false, hostel: null });
  const [roomDialog, setRoomDialog] = useState<{ hostelId: string | null; room: HostelRoom | null }>({ hostelId: null, room: null });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["hostel"] });
  const onError = (err: unknown) => window.alert(apiErrorMessage(err, "Could not delete."));
  const removeHostel = useMutation({ mutationFn: (id: string) => deleteHostel(id), onSuccess: invalidate, onError });
  const removeRoom = useMutation({ mutationFn: (id: string) => deleteRoom(id), onSuccess: invalidate, onError });

  return (
    <AppShell title="Hostel" navItems={adminNavWithTransportHostel()}>
      <PageHeader
        title="Hostels & Rooms"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setHostelDialog({ open: true, hostel: null })}>
            Add hostel
          </Button>
        }
      />
      {hostels.isLoading && <Typography>Loading…</Typography>}
      {hostels.data?.length === 0 && <Alert severity="info">No hostels yet — add a hostel, then its rooms.</Alert>}

      <Stack spacing={2}>
        {hostels.data?.map((h) => {
          const hostelRooms = rooms.data?.filter((r) => r.hostel_id === h.id) ?? [];
          return (
            <Paper key={h.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                <Box>
                  <Typography variant="h6">
                    {h.name}
                    <Chip size="small" label={h.hostel_type} sx={{ ml: 1, textTransform: "capitalize" }} />
                    {h.status !== "active" && <Chip size="small" label={h.status} sx={{ ml: 1 }} />}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Warden: {h.warden_name ?? "—"} {h.warden_phone && `(${h.warden_phone})`} · {h.room_count} room(s) ·{" "}
                    {h.occupied_beds}/{h.total_beds} beds occupied
                  </Typography>
                  {h.address && <Typography variant="body2" color="text.secondary">{h.address}</Typography>}
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setRoomDialog({ hostelId: h.id, room: null })}>
                    Room
                  </Button>
                  <Button size="small" onClick={() => setHostelDialog({ open: true, hostel: h })}>Edit</Button>
                  <Button size="small" color="error" onClick={() => window.confirm(`Delete hostel ${h.name}?`) && removeHostel.mutate(h.id)}>
                    Delete
                  </Button>
                </Stack>
              </Stack>
              {hostelRooms.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No rooms added yet.</Typography>
              ) : (
                <TableContainer sx={{ borderRadius: 1, border: "1px solid #e0e0e0" }}>
                  <Table size="small">
                    <TableHead sx={darkTableHeadSx}>
                      <TableRow>
                        <TableCell>Room</TableCell>
                        <TableCell>Floor</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Beds</TableCell>
                        <TableCell>Occupied</TableCell>
                        <TableCell>Monthly fee</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {hostelRooms.map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{r.room_number}</TableCell>
                          <TableCell>{r.floor ?? "—"}</TableCell>
                          <TableCell>{r.room_type ?? "—"}</TableCell>
                          <TableCell>{r.capacity}</TableCell>
                          <TableCell>
                            <Chip size="small" label={`${r.occupied}/${r.capacity}`} color={r.available === 0 ? "error" : r.occupied ? "warning" : "success"} variant="outlined" />
                          </TableCell>
                          <TableCell>{fmtMoney(r.monthly_fee)}</TableCell>
                          <TableCell>{r.status}</TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => setRoomDialog({ hostelId: h.id, room: r })}>Edit</Button>
                            <Button size="small" color="error" onClick={() => window.confirm(`Delete room ${r.room_number}?`) && removeRoom.mutate(r.id)}>
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          );
        })}
      </Stack>

      <HostelDialog open={hostelDialog.open} hostel={hostelDialog.hostel} onClose={() => setHostelDialog({ open: false, hostel: null })} />
      <RoomDialog hostelId={roomDialog.hostelId} room={roomDialog.room} onClose={() => setRoomDialog({ hostelId: null, room: null })} />
    </AppShell>
  );
}
