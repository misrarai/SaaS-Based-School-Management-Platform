import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Chip,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { getCourseGradebook, listCourses, type Course } from "../../../api/courses";

const EMPTY_COURSES: Course[] = [];

function averageColor(percent: number | null): "success" | "warning" | "error" | "default" {
  if (percent === null) return "default";
  if (percent >= 70) return "success";
  if (percent >= 40) return "warning";
  return "error";
}

export function GradebookPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const courseId = searchParams.get("courseId") ?? "";

  const coursesQuery = useQuery({ queryKey: ["courses", "mine"], queryFn: () => listCourses() });
  const courses = coursesQuery.data ?? EMPTY_COURSES;

  useEffect(() => {
    if (!courseId && courses.length > 0) {
      setSearchParams({ courseId: courses[0].id }, { replace: true });
    }
  }, [courseId, courses, setSearchParams]);

  const gradebookQuery = useQuery({
    queryKey: ["courses", courseId, "gradebook"],
    queryFn: () => getCourseGradebook(courseId),
    enabled: !!courseId,
  });
  const rows = gradebookQuery.data ?? [];

  const selectedCourse = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  return (
    <AppShell title="Gradebook" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Gradebook
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Graded assignment marks for one of your classes.
      </Typography>

      {courses.length === 0 && !coursesQuery.isLoading && (
        <Alert severity="info">You aren't assigned to any classes yet.</Alert>
      )}

      {courses.length > 0 && (
        <TextField
          select
          label="Class"
          size="small"
          value={courseId}
          onChange={(e) => setSearchParams({ courseId: e.target.value })}
          sx={{ mb: 3, minWidth: 320 }}
        >
          {courses.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.subject_name} — {c.class_grade_name} {c.section_name}
            </MenuItem>
          ))}
        </TextField>
      )}

      {gradebookQuery.isLoading && <Typography>Loading…</Typography>}

      {selectedCourse && rows.length === 0 && !gradebookQuery.isLoading && (
        <Alert severity="info">No grades recorded yet for {selectedCourse.subject_name}.</Alert>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Assignments graded</TableCell>
                <TableCell align="right">Average</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.student_id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{row.full_name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell align="right">{row.assignments_graded}</TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      color={averageColor(row.average_percent)}
                      label={row.average_percent === null ? "Not graded" : `${row.average_percent}%`}
                    />
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
