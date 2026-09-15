import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
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
import { listCourses } from "../../../api/courses";

export function MyClassesPage() {
  const coursesQuery = useQuery({ queryKey: ["courses", "mine"], queryFn: () => listCourses() });
  const courses = coursesQuery.data ?? [];

  return (
    <AppShell title="My Classes" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        My Classes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every course you're assigned to teach.
      </Typography>

      {coursesQuery.isLoading && <Typography>Loading…</Typography>}
      {courses.length === 0 && !coursesQuery.isLoading && (
        <Alert severity="info">You haven't been assigned to any courses yet — ask your admin to assign you.</Alert>
      )}

      {courses.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Subject</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Academic Year</TableCell>
                <TableCell>Students</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{course.subject_name}</TableCell>
                  <TableCell>{course.class_grade_name}</TableCell>
                  <TableCell>{course.section_name}</TableCell>
                  <TableCell>{course.academic_year_name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={`${course.student_count} students`} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      <Button size="small" component={RouterLink} to={`/teacher/gradebook?courseId=${course.id}`}>
                        Gradebook
                      </Button>
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
