import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listSessions, type ClassSession } from "../../../api/schedule";
import { getRoster, markAttendance, type AttendanceStatus } from "../../../api/attendance";

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "excused"];

function AttendanceDialog({ session, onClose }: { session: ClassSession | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});

  const rosterQuery = useQuery({
    queryKey: ["attendance-roster", session?.id],
    queryFn: () => getRoster(session!.id),
    enabled: !!session,
  });

  const save = useMutation({
    mutationFn: () =>
      markAttendance(
        session!.id,
        Object.entries(draft).map(([student_id, status]) => ({ student_id, status })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-roster", session?.id] });
      setDraft({});
      onClose();
    },
  });

  function statusFor(studentId: string, current: AttendanceStatus | null) {
    return draft[studentId] ?? current ?? "present";
  }

  return (
    <Dialog open={!!session} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Mark attendance — {session?.session_date}</DialogTitle>
      <DialogContent>
        {rosterQuery.isLoading && <Typography>Loading roster…</Typography>}
        {rosterQuery.data?.length === 0 && <Alert severity="info">No active students in this section.</Alert>}
        {!!rosterQuery.data?.length && (
          <Table size="small">
            <TableBody>
              {rosterQuery.data.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell>{r.roll_number ?? "—"}</TableCell>
                  <TableCell align="right">
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={statusFor(r.student_id, r.status)}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [r.student_id]: e.target.value as AttendanceStatus }))
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>
                            {s}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => save.mutate()}
          disabled={save.isPending || !rosterQuery.data?.length}
        >
          Save attendance
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MarkAttendancePage() {
  const sessionsQuery = useQuery({
    queryKey: ["schedule-sessions", "teacher-attendance-range"],
    queryFn: () => listSessions({ dateFrom: addDaysIso(-7), dateTo: addDaysIso(7) }),
  });
  const [activeSession, setActiveSession] = useState<ClassSession | null>(null);

  return (
    <AppShell title="Attendance" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Mark attendance
      </Typography>

      {sessionsQuery.data?.length === 0 && <Alert severity="info">No sessions in the last or next 7 days.</Alert>}

      {!!sessionsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessionsQuery.data.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.session_date}</TableCell>
                  <TableCell>
                    {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setActiveSession(s)}>
                      Mark attendance
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AttendanceDialog session={activeSession} onClose={() => setActiveSession(null)} />
    </AppShell>
  );
}
