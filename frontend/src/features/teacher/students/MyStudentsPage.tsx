import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Chip,
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
import SearchIcon from "@mui/icons-material/Search";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listMyStudents, type TeacherStudentSummary } from "../../../api/courses";

const EMPTY_STUDENTS: TeacherStudentSummary[] = [];

export function MyStudentsPage() {
  const [query, setQuery] = useState("");
  const studentsQuery = useQuery({ queryKey: ["courses", "students", "mine"], queryFn: listMyStudents });
  const students = studentsQuery.data ?? EMPTY_STUDENTS;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.class_grade_name.toLowerCase().includes(q) ||
        s.section_name.toLowerCase().includes(q),
    );
  }, [students, query]);

  return (
    <AppShell title="My Students" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        My Students
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every student across all the classes you teach.
      </Typography>

      <TextField
        placeholder="Search by name, email, grade or section"
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 2, maxWidth: 400 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
      />

      {studentsQuery.isLoading && <Typography>Loading…</Typography>}
      {filtered.length === 0 && !studentsQuery.isLoading && (
        <Alert severity="info">
          {students.length === 0 ? "No students in your assigned classes yet." : "No students match your search."}
        </Alert>
      )}

      {filtered.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Subjects with you</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.student_id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{s.full_name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.class_grade_name}</TableCell>
                  <TableCell>{s.section_name}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                      {s.subjects.map((subject) => (
                        <Chip key={subject} size="small" label={subject} />
                      ))}
                    </Stack>
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
