import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Chip,
  FormControl,
  InputLabel,
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
import { AppShell } from "../../components/AppShell";
import { parentNavItems } from "./parentNav";
import { darkTableHeadSx } from "../../components/tableStyles";
import { listMyChildren } from "../../api/parents";
import { listSessions } from "../../api/schedule";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function TimetablePage() {
  const childrenQuery = useQuery({ queryKey: ["parents", "me", "children"], queryFn: listMyChildren });
  const [studentId, setStudentId] = useState("");
  const effectiveStudentId = studentId || childrenQuery.data?.[0]?.id || "";
  const activeChild = childrenQuery.data?.find((c) => c.id === effectiveStudentId);

  const sessionsQuery = useQuery({
    queryKey: ["schedule-sessions", "parent-timetable", activeChild?.section_id],
    queryFn: () =>
      listSessions({ sectionId: activeChild?.section_id ?? undefined, dateFrom: todayIso(), dateTo: addDaysIso(13) }),
    enabled: !!activeChild?.section_id,
  });

  return (
    <AppShell title="Timetable" navItems={parentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Timetable
      </Typography>

      <FormControl size="small" sx={{ minWidth: 200, mb: 3 }}>
        <InputLabel id="child-label">Child</InputLabel>
        <Select labelId="child-label" label="Child" value={effectiveStudentId} onChange={(e) => setStudentId(e.target.value)}>
          {childrenQuery.data?.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.full_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {sessionsQuery.data?.length === 0 && <Alert severity="info">No classes scheduled yet.</Alert>}

      {!!sessionsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
