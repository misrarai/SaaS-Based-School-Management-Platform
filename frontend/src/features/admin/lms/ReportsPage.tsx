import { useQuery } from "@tanstack/react-query";
import {
  Box,
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
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listSessions } from "../../../api/schedule";
import { listResources } from "../../../api/resources";
import { listQuizzes } from "../../../api/quizzes";
import { listAssignments } from "../../../api/assignments";
import { LmsShell, PageHeader, StatTile, useAcademics, fmtDate } from "./common";

export function LmsReportsPage() {
  const academics = useAcademics();
  const sessions = useQuery({ queryKey: ["lms-sessions-all"], queryFn: () => listSessions() });
  const lectures = useQuery({ queryKey: ["lms-lectures-all"], queryFn: () => listResources({ resourceType: "video" }) });
  const quizzes = useQuery({ queryKey: ["lms-quizzes-all"], queryFn: () => listQuizzes() });
  const assignments = useQuery({ queryKey: ["lms-assignments-all"], queryFn: () => listAssignments() });

  const sess = sessions.data ?? [];
  const upcoming = sess.filter((s) => s.status === "scheduled").length;
  const completed = sess.filter((s) => s.status === "completed").length;
  const publishedQuizzes = (quizzes.data ?? []).filter((q) => q.is_published).length;

  const recent = [...sess]
    .sort((a, b) => (a.session_date < b.session_date ? 1 : -1))
    .slice(0, 8);

  return (
    <LmsShell title="Reports">
      <PageHeader title="LMS Reports" />

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2, mb: 3 }}>
        <StatTile label="Online classes" value={sess.length} color="#2563eb" />
        <StatTile label="Upcoming" value={upcoming} color="#059669" />
        <StatTile label="Completed" value={completed} />
        <StatTile label="Video lectures" value={lectures.data?.length ?? 0} color="#7c3aed" />
        <StatTile label="Quizzes (published)" value={`${publishedQuizzes} / ${quizzes.data?.length ?? 0}`} color="#d97706" />
        <StatTile label="Assignments" value={assignments.data?.length ?? 0} color="#dc2626" />
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>Recent online classes</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Class · Section</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Teacher</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : recent.length === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No online classes yet.</TableCell></TableRow>
            ) : (
              recent.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.title || "Class"}</TableCell>
                  <TableCell>{academics.sectionLabel(s.section_id)}</TableCell>
                  <TableCell>{academics.subjectLabel(s.subject_id)}</TableCell>
                  <TableCell>{academics.teacherLabel(s.teacher_id)}</TableCell>
                  <TableCell>{fmtDate(s.session_date)}</TableCell>
                  <TableCell>{s.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ height: 24 }} />
    </LmsShell>
  );
}
