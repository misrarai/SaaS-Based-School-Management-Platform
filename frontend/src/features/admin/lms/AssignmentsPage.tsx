import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/GroupsOutlined";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listAssignments, listSubmissions, type Assignment } from "../../../api/assignments";
import { resolveUploadUrl } from "../../../api/uploads";
import { LmsShell, PageHeader, useAcademics, fmtDate, fmtDateTime } from "./common";

function SubmissionsDialog({ assignment, onClose }: { assignment: Assignment; onClose: () => void }) {
  const subs = useQuery({ queryKey: ["lms-submissions", assignment.id], queryFn: () => listSubmissions(assignment.id) });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Submissions — {assignment.title}</DialogTitle>
      <DialogContent>
        {subs.isLoading ? (
          <Typography>Loading…</Typography>
        ) : (subs.data?.length ?? 0) === 0 ? (
          <Alert severity="info">No submissions yet.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Late?</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell align="right">Marks</TableCell>
                  <TableCell>Feedback</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subs.data!.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>{fmtDateTime(s.submitted_at)}</TableCell>
                    <TableCell>{s.is_late ? <Chip size="small" color="warning" label="Late" /> : "—"}</TableCell>
                    <TableCell>
                      {s.submitted_file_url ? (
                        <Link href={resolveUploadUrl(s.submitted_file_url)} target="_blank" rel="noopener">Open</Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {s.marks_obtained != null ? `${s.marks_obtained}${assignment.max_marks ? ` / ${assignment.max_marks}` : ""}` : "—"}
                    </TableCell>
                    <TableCell>{s.teacher_feedback || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

export function AdminAssignmentsPage() {
  const academics = useAcademics();
  const [subsFor, setSubsFor] = useState<Assignment | null>(null);
  const assignments = useQuery({ queryKey: ["lms-assignments"], queryFn: () => listAssignments() });

  return (
    <LmsShell title="Assignments">
      <PageHeader title="Assignments" />
      <Alert severity="info" sx={{ mb: 2 }}>
        Assignments are set by teachers in their portal. This is the school-wide overview — open one to review its submissions.
      </Alert>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Class · Section</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Teacher</TableCell>
              <TableCell>Due date</TableCell>
              <TableCell align="right">Max marks</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assignments.isLoading ? (
              <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>
            ) : (assignments.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} sx={{ color: "text.secondary" }}>No assignments yet.</TableCell></TableRow>
            ) : (
              assignments.data!.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>{academics.sectionLabel(a.section_id)}</TableCell>
                  <TableCell>{academics.subjectLabel(a.subject_id)}</TableCell>
                  <TableCell>{academics.teacherLabel(a.teacher_id)}</TableCell>
                  <TableCell>{fmtDate(a.due_date)}</TableCell>
                  <TableCell align="right">{a.max_marks ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<PeopleIcon />} onClick={() => setSubsFor(a)}>Submissions</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {subsFor && <SubmissionsDialog assignment={subsFor} onClose={() => setSubsFor(null)} />}
    </LmsShell>
  );
}
