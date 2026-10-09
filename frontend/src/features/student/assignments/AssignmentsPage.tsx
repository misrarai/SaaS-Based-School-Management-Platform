import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { uploadDocument } from "../../../api/uploads";
import { getGradebook, listAssignments, submitAssignment, type Assignment } from "../../../api/assignments";

function isOverdue(assignment: Assignment) {
  return new Date(assignment.due_date).getTime() < Date.now();
}

export function AssignmentsPage() {
  const queryClient = useQueryClient();
  const assignmentsQuery = useQuery({ queryKey: ["assignments", "student"], queryFn: () => listAssignments() });
  const gradebookQuery = useQuery({ queryKey: ["gradebook", "me"], queryFn: () => getGradebook() });
  const gradeById = new Map((gradebookQuery.data ?? []).map((g) => [g.assignment_id, g]));
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async ({ assignmentId, file }: { assignmentId: string; file: File }) => {
      setUploadingId(assignmentId);
      const url = await uploadDocument(file);
      return submitAssignment(assignmentId, url);
    },
    onSuccess: () => {
      setUploadingId(null);
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["gradebook"] });
    },
    onError: () => setUploadingId(null),
  });

  return (
    <AppShell title="Assignments" navItems={studentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Assignments
      </Typography>

      {assignmentsQuery.data?.length === 0 && <Alert severity="info">No assignments yet.</Alert>}

      {!!assignmentsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Marks</TableCell>
                <TableCell>Feedback</TableCell>
                <TableCell align="right">Submit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignmentsQuery.data.map((a) => {
                const graded = gradeById.get(a.id);
                return (
                <TableRow key={a.id} hover>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>{new Date(a.due_date).toLocaleString()}</TableCell>
                  <TableCell>
                    {graded ? (
                      <Chip size="small" label="Graded" color="success" />
                    ) : isOverdue(a) ? (
                      <Chip size="small" label="Overdue" color="error" />
                    ) : (
                      <Chip size="small" label="Open" color="info" />
                    )}
                  </TableCell>
                  <TableCell>
                    {graded ? `${graded.marks_obtained} / ${graded.max_marks ?? a.max_marks ?? "—"}` : a.max_marks ? `— / ${a.max_marks}` : "—"}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 280, color: graded?.teacher_feedback ? "text.primary" : "text.secondary" }}>
                    {graded?.teacher_feedback || "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Button component="label" size="small" variant="contained" disabled={uploadingId === a.id}>
                      {uploadingId === a.id ? "Uploading…" : "Upload"}
                      <input
                        type="file"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) submit.mutate({ assignmentId: a.id, file });
                        }}
                      />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
