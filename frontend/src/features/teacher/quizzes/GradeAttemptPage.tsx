import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { getAttemptReview, gradeAttempt } from "../../../api/quizzes";

export function GradeAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const reviewQuery = useQuery({
    queryKey: ["quiz-attempt-review", attemptId],
    queryFn: () => getAttemptReview(attemptId!),
    enabled: !!attemptId,
  });

  const [marks, setMarks] = useState<Record<string, string>>({});

  const grade = useMutation({
    mutationFn: () => {
      const shortAnswerQuestions = (reviewQuery.data?.questions ?? []).filter((q) => q.question_type === "short_answer");
      return gradeAttempt(
        attemptId!,
        shortAnswerQuestions.map((q) => ({ question_id: q.id, marks_awarded: Number(marks[q.id] ?? 0) })),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz-results"] });
      navigate(-1);
    },
  });

  const review = reviewQuery.data;
  const shortAnswerQuestions = (review?.questions ?? []).filter((q) => q.question_type === "short_answer");

  return (
    <AppShell title="Grade Answers" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Grade short answers
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Everything else on this attempt is already auto-graded — just score the free-text answers below.
      </Typography>

      {reviewQuery.isLoading && <Typography>Loading…</Typography>}

      {review && shortAnswerQuestions.length === 0 && (
        <Alert severity="info">Nothing left to grade manually on this attempt.</Alert>
      )}

      {review && shortAnswerQuestions.length > 0 && (
        <Box component="form" onSubmit={(e) => { e.preventDefault(); grade.mutate(); }}>
          <Stack spacing={2}>
            {shortAnswerQuestions.map((q, i) => (
              <Paper key={q.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography component="div" sx={{ fontWeight: 600, mb: 1 }}>
                  {i + 1}. {q.question_text}{" "}
                  <Chip size="small" label={`out of ${q.marks}`} sx={{ ml: 1 }} />
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>
                  {q.answer_text || "(no answer submitted)"}
                </Typography>
                <TextField
                  label="Marks awarded"
                  type="number"
                  size="small"
                  value={marks[q.id] ?? ""}
                  onChange={(e) => setMarks((m) => ({ ...m, [q.id]: e.target.value }))}
                  slotProps={{ htmlInput: { min: 0, max: q.marks, step: 0.5 } }}
                  required
                  sx={{ maxWidth: 200 }}
                />
              </Paper>
            ))}

            {grade.isError && <Alert severity="error">Could not save grades — check marks don't exceed each question's total.</Alert>}

            <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
              <Button variant="outlined" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={grade.isPending}>
                {grade.isPending ? "Saving…" : "Save grades"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </AppShell>
  );
}
