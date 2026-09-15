import { useState } from "react";
import { useParams } from "react-router-dom";
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
  Link as MuiLink,
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
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { resolveUploadUrl } from "../../../api/uploads";
import { gradeSubmission, listSubmissions, type Submission } from "../../../api/assignments";

function GradeDialog({ submission, onClose }: { submission: Submission | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  const grade = useMutation({
    mutationFn: () => gradeSubmission(submission!.id, Number(marks), feedback || undefined),
    onSuccess: () => {
      setMarks("");
      setFeedback("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions"] });
      onClose();
    },
    onError: () => setError("Could not save grade — check it doesn't exceed the max marks."),
  });

  return (
    <Dialog open={!!submission} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Grade submission</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          grade.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label="Marks obtained"
              type="number"
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Feedback (optional)"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={grade.isPending}>
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function SubmissionsReviewPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const submissionsQuery = useQuery({
    queryKey: ["assignment-submissions", assignmentId],
    queryFn: () => listSubmissions(assignmentId!),
    enabled: !!assignmentId,
  });
  const [gradeTarget, setGradeTarget] = useState<Submission | null>(null);

  return (
    <AppShell title="Marking Desk" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Submissions
      </Typography>

      {submissionsQuery.data?.length === 0 && <Alert severity="info">No submissions yet.</Alert>}

      {!!submissionsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Submitted</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Marks</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {submissionsQuery.data.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    {s.submitted_file_url ? (
                      <MuiLink href={resolveUploadUrl(s.submitted_file_url)} target="_blank" rel="noopener noreferrer">
                        View
                      </MuiLink>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {s.is_late ? (
                      <Chip size="small" label="Late" color="warning" />
                    ) : (
                      <Chip size="small" label="On time" color="success" />
                    )}
                  </TableCell>
                  <TableCell>{s.marks_obtained ?? "Not graded"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setGradeTarget(s)}>
                      {s.marks_obtained === null ? "Grade" : "Regrade"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <GradeDialog submission={gradeTarget} onClose={() => setGradeTarget(null)} />
    </AppShell>
  );
}
