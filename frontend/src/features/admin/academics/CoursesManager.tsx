import { useMemo, useState, type ReactNode } from "react";
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
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listAcademicYears } from "../../../api/academicYears";
import { listClasses, listSections, listSubjects } from "../../../api/classes";
import {
  assignTeacher,
  createCourse,
  dropStudent,
  enrollStudent,
  listCourseStudents,
  listCourses,
  unassignTeacher,
  type Course,
} from "../../../api/courses";
import { listTeachers } from "../../../api/teachers";
import { listStudents } from "../../../api/students";
import { apiErrorMessage } from "../../../lib/apiError";

function CreateCourseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const years = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const sections = useQuery({ queryKey: ["sections", classId], queryFn: () => listSections(classId), enabled: !!classId });
  const subjects = useQuery({ queryKey: ["subjects", classId], queryFn: () => listSubjects(classId), enabled: !!classId });
  const activeYear = years.data?.find((y) => y.is_active);
  const effectiveYear = yearId || activeYear?.id || "";

  const mutation = useMutation({
    mutationFn: () => createCourse({ academic_year_id: effectiveYear, section_id: sectionId, subject_id: subjectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setSectionId("");
      setSubjectId("");
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New course</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {years.data && years.data.length === 0 && (
            <Alert severity="warning">Create an academic year first (Academics → Academic Years).</Alert>
          )}
          <TextField select label="Academic year" value={effectiveYear} onChange={(e) => setYearId(e.target.value)} required>
            {(years.data ?? []).map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.name} {y.is_active ? "(current)" : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
              setSubjectId("");
            }}
            required
          >
            {(classes.data ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} required disabled={!classId}>
            {(sections.data ?? []).map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required disabled={!classId}>
            {(subjects.data ?? []).map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} ({s.code})
              </MenuItem>
            ))}
          </TextField>
          {mutation.isError && <Alert severity="error">{apiErrorMessage(mutation.error, "Could not create course.")}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!effectiveYear || !sectionId || !subjectId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ManageCourseDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const teachersQuery = useQuery({ queryKey: ["teachers", ""], queryFn: () => listTeachers() });
  const enrolledQuery = useQuery({ queryKey: ["course-students", course.id], queryFn: () => listCourseStudents(course.id) });
  const classStudentsQuery = useQuery({
    queryKey: ["students", { classGradeId: course.class_grade_id, status: "active" }],
    queryFn: () => listStudents({ classGradeId: course.class_grade_id, status: "active" }),
  });
  const coursesQuery = useQuery({ queryKey: ["courses", {}], queryFn: () => listCourses() });
  const live = coursesQuery.data?.find((c) => c.id === course.id) ?? course;

  const enrolled = (enrolledQuery.data ?? []).filter((e) => e.status === "active");
  const enrolledIds = new Set(enrolled.map((e) => e.student_id));
  const candidates = (classStudentsQuery.data ?? []).filter((s) => !enrolledIds.has(s.id));
  const sectionCandidates = candidates.filter((s) => s.section_id === course.section_id);
  const assignedIds = new Set(live.teachers.map((t) => t.teacher_id));

  function refresh() {
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["course-students", course.id] });
  }
  const onError = (err: unknown) => setError(apiErrorMessage(err));

  const assign = useMutation({
    mutationFn: () => assignTeacher(course.id, teacherId),
    onSuccess: () => {
      setTeacherId("");
      setError(null);
      refresh();
    },
    onError,
  });
  const unassign = useMutation({ mutationFn: (tid: string) => unassignTeacher(course.id, tid), onSuccess: refresh, onError });
  const enroll = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await enrollStudent(course.id, id);
    },
    onSuccess: () => {
      setStudentId("");
      setError(null);
      refresh();
    },
    onError: (err) => {
      onError(err);
      refresh();
    },
  });
  const drop = useMutation({ mutationFn: (sid: string) => dropStudent(course.id, sid), onSuccess: refresh, onError });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {course.subject_name} — {course.class_grade_name} {course.section_name}
        <Typography variant="body2" color="text.secondary">
          {course.academic_year_name}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={`Teachers (${live.teachers.length})`} />
          <Tab label={`Students (${enrolled.length})`} />
        </Tabs>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {tab === 0 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField select label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} size="small" sx={{ flex: 1 }}>
                {(teachersQuery.data ?? [])
                  .filter((t) => t.is_active && !assignedIds.has(t.id))
                  .map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.full_name} — {t.email}
                    </MenuItem>
                  ))}
              </TextField>
              <Button variant="contained" startIcon={<AddIcon />} disabled={!teacherId || assign.isPending} onClick={() => assign.mutate()}>
                Assign
              </Button>
            </Stack>
            <List dense>
              {live.teachers.map((t) => (
                <ListItem
                  key={t.teacher_id}
                  divider
                  secondaryAction={
                    <Tooltip title="Remove teacher">
                      <IconButton edge="end" onClick={() => unassign.mutate(t.teacher_id)} disabled={unassign.isPending}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemText primary={t.full_name} secondary={t.email} />
                </ListItem>
              ))}
              {live.teachers.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No teachers assigned yet.
                </Typography>
              )}
            </List>
          </Stack>
        )}
        {tab === 1 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField select label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)} size="small" sx={{ flex: 1 }}>
                {candidates.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.full_name} {s.admission_number ? `(${s.admission_number})` : ""}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" startIcon={<AddIcon />} disabled={!studentId || enroll.isPending} onClick={() => enroll.mutate([studentId])}>
                Enroll
              </Button>
              <Button
                variant="outlined"
                disabled={!sectionCandidates.length || enroll.isPending}
                onClick={() => enroll.mutate(sectionCandidates.map((s) => s.id))}
              >
                Enroll whole section ({sectionCandidates.length})
              </Button>
            </Stack>
            {(enrolledQuery.isLoading || enroll.isPending) && <LinearProgress />}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Enrolled</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enrolled.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.full_name}</TableCell>
                      <TableCell>{e.email}</TableCell>
                      <TableCell>{e.enrolled_date}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Remove from course">
                          <IconButton size="small" onClick={() => drop.mutate(e.student_id)} disabled={drop.isPending}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!enrolledQuery.isLoading && enrolled.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                        No students enrolled.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Admin course management: create courses, assign teachers, enroll students.
 *  `filterCourse` lets other pages (e.g. Extra Coaching) show a subset. */
export function CoursesManager({
  filterCourse,
  intro,
  emptyText = "No courses yet. Create one to link a section, subject and teachers.",
}: {
  filterCourse?: (c: Course) => boolean;
  intro?: ReactNode;
  emptyText?: string;
}) {
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [managing, setManaging] = useState<Course | null>(null);

  const years = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const coursesQuery = useQuery({ queryKey: ["courses", {}], queryFn: () => listCourses() });

  const courses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (coursesQuery.data ?? [])
      .filter((c) => !filterCourse || filterCourse(c))
      .filter((c) => !yearId || c.academic_year_id === yearId)
      .filter((c) => !classId || c.class_grade_id === classId)
      .filter(
        (c) =>
          !q ||
          c.subject_name.toLowerCase().includes(q) ||
          c.teachers.some((t) => t.full_name.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          a.class_grade_name.localeCompare(b.class_grade_name) ||
          a.section_name.localeCompare(b.section_name) ||
          a.subject_name.localeCompare(b.subject_name),
      );
  }, [coursesQuery.data, filterCourse, yearId, classId, search]);

  return (
    <Box>
      {intro}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
          <TextField select label="Academic year" value={yearId} onChange={(e) => setYearId(e.target.value)} size="small" sx={{ minWidth: 180 }}>
            <MenuItem value="">All years</MenuItem>
            {(years.data ?? []).map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} size="small" sx={{ minWidth: 180 }}>
            <MenuItem value="">All classes</MenuItem>
            {(classes.data ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Search subject / teacher" value={search} onChange={(e) => setSearch(e.target.value)} size="small" sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New course
          </Button>
        </Stack>
      </Paper>

      {coursesQuery.isError && <Alert severity="error">{apiErrorMessage(coursesQuery.error, "Could not load courses.")}</Alert>}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        {coursesQuery.isLoading && <LinearProgress />}
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Year</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Section</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Teachers</TableCell>
              <TableCell align="right">Students</TableCell>
              <TableCell align="right">Manage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.academic_year_name}</TableCell>
                <TableCell>{c.class_grade_name}</TableCell>
                <TableCell>{c.section_name}</TableCell>
                <TableCell>
                  {c.subject_name} {!c.is_active && <Chip size="small" label="inactive" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    {c.teachers.map((t) => (
                      <Chip key={t.teacher_id} size="small" label={t.full_name} />
                    ))}
                    {c.teachers.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Unassigned
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">{c.student_count}</TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<SettingsIcon />} onClick={() => setManaging(c)}>
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!coursesQuery.isLoading && courses.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateCourseDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {managing && <ManageCourseDialog course={managing} onClose={() => setManaging(null)} />}
    </Box>
  );
}
