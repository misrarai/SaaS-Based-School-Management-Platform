import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { getMyAttempt, getQuizForTaking, startAttempt, submitAttempt } from "../../../api/quizzes";

function useCountdownSeconds(deadline: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function gradeColor(grade: string | null): "success" | "warning" | "error" | "default" {
  if (grade === "A" || grade === "B") return "success";
  if (grade === "C" || grade === "D") return "warning";
  if (grade === "F") return "error";
  return "default";
}

export function TakeQuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const attemptQuery = useQuery({
    queryKey: ["quiz-attempt-start", quizId],
    queryFn: () => startAttempt(quizId!),
    enabled: !!quizId,
  });
  const attempt = attemptQuery.data;
  const hasSubmitted = attempt?.status === "submitted" || attempt?.status === "graded";

  const quizQuery = useQuery({
    queryKey: ["quiz-take", quizId],
    queryFn: () => getQuizForTaking(quizId!),
    enabled: !!quizId && !!attempt && !hasSubmitted,
  });

  const reviewQuery = useQuery({
    queryKey: ["quiz-my-attempt", quizId],
    queryFn: () => getMyAttempt(quizId!),
    enabled: !!quizId && hasSubmitted,
  });

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});

  const deadline = useMemo(() => {
    if (!attempt) return null;
    const timeLimit = quizQuery.data?.time_limit_minutes;
    if (!timeLimit) return null;
    return new Date(new Date(attempt.started_at).getTime() + timeLimit * 60_000);
  }, [attempt, quizQuery.data]);
  const secondsLeft = useCountdownSeconds(deadline);

  const submit = useMutation({
    mutationFn: () => {
      const quiz = quizQuery.data!;
      return submitAttempt(
        attempt!.id,
        quiz.questions.map((q) =>
          q.question_type === "short_answer"
            ? { question_id: q.id, answer_text: answerTexts[q.id] ?? "" }
            : { question_id: q.id, selected_option_id: selectedOptions[q.id] ?? null },
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz-my-attempt", quizId] });
      queryClient.invalidateQueries({ queryKey: ["quiz-attempt-start", quizId] });
    },
  });

  useEffect(() => {
    if (secondsLeft === 0 && !hasSubmitted && !submit.isPending && !submit.isSuccess) {
      submit.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (attemptQuery.isLoading) {
    return (
      <AppShell title="Quiz" navItems={studentNavItems}>
        <Typography>Loading…</Typography>
      </AppShell>
    );
  }

  if (hasSubmitted || submit.isSuccess) {
    const review = reviewQuery.data;
    const stillGrading = review?.status === "submitted";
    return (
      <AppShell title="Quiz Results" navItems={studentNavItems}>
        <Button onClick={() => navigate("/student/quizzes")} sx={{ mb: 2 }}>
          Back to quizzes
        </Button>
        {!review && <Typography>Loading results…</Typography>}
        {review && (
          <Stack spacing={2}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                {stillGrading ? (
                  <Alert severity="info" sx={{ mb: 0 }}>
                    Submitted — your teacher still needs to grade one or more short-answer questions before your
                    final result is ready.
                  </Alert>
                ) : (
                  <Stack direction="row" spacing={3} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      Score: {review.score} / {review.max_score}
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                      {review.percentage}%
                    </Typography>
                    <Chip label={`Grade ${review.grade}`} color={gradeColor(review.grade)} sx={{ fontWeight: 700 }} />
                  </Stack>
                )}
              </CardContent>
            </Card>
            {review.questions.map((q, i) => (
              <Paper key={q.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography component="div" sx={{ fontWeight: 600, mb: 1 }}>
                  {i + 1}. {q.question_text}{" "}
                  {q.question_type === "short_answer" ? (
                    q.marks_awarded !== null ? (
                      <Chip size="small" label={`${q.marks_awarded} / ${q.marks} marks`} color="default" sx={{ ml: 1 }} />
                    ) : (
                      <Chip size="small" label="Pending review" color="warning" sx={{ ml: 1 }} />
                    )
                  ) : (
                    <Chip
                      size="small"
                      label={q.is_correct ? "Correct" : "Incorrect"}
                      color={q.is_correct ? "success" : "error"}
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
                {q.question_type === "short_answer" ? (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                    Your answer: {q.answer_text || "(no answer submitted)"}
                  </Typography>
                ) : (
                  <Stack spacing={0.5}>
                    {q.options.map((o) => (
                      <Typography
                        key={o.id}
                        variant="body2"
                        sx={{
                          color: o.is_correct ? "success.main" : o.id === q.selected_option_id ? "error.main" : "text.primary",
                          fontWeight: o.id === q.selected_option_id || o.is_correct ? 600 : 400,
                        }}
                      >
                        {o.option_text}
                        {o.is_correct ? " (correct answer)" : o.id === q.selected_option_id ? " (your answer)" : ""}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </AppShell>
    );
  }

  const quiz = quizQuery.data;

  return (
    <AppShell title={quiz?.title ?? "Quiz"} navItems={studentNavItems}>
      {quiz && (
        <>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h4">{quiz.title}</Typography>
            {secondsLeft !== null && (
              <Chip label={`Time left: ${formatSeconds(secondsLeft)}`} color={secondsLeft < 60 ? "error" : "default"} />
            )}
          </Stack>
          {quiz.description && (
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {quiz.description}
            </Typography>
          )}

          <Stack spacing={2}>
            {quiz.questions.map((q, i) => (
              <Paper key={q.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography component="div" sx={{ fontWeight: 600, mb: 1 }}>
                  {i + 1}. {q.question_text}{" "}
                  <Typography component="span" variant="body2" color="text.secondary">
                    ({q.marks} marks)
                  </Typography>
                </Typography>
                {q.question_type === "short_answer" ? (
                  <TextField
                    value={answerTexts[q.id] ?? ""}
                    onChange={(e) => setAnswerTexts((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Type your answer…"
                    fullWidth
                    multiline
                    minRows={3}
                  />
                ) : (
                  <RadioGroup
                    value={selectedOptions[q.id] ?? ""}
                    onChange={(e) => setSelectedOptions((a) => ({ ...a, [q.id]: e.target.value }))}
                  >
                    {q.options.map((o) => (
                      <FormControlLabel key={o.id} value={o.id} control={<Radio />} label={o.option_text} />
                    ))}
                  </RadioGroup>
                )}
              </Paper>
            ))}
          </Stack>

          {submit.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Could not submit — please try again.
            </Alert>
          )}

          <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 3 }}>
            <Button variant="contained" onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit quiz"}
            </Button>
          </Stack>
        </>
      )}
    </AppShell>
  );
}
