import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import HistoryIcon from "@mui/icons-material/HistoryOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  listMyAttempts,
  getAttemptReview,
  type MyAttemptHistoryEntry,
  type ReviewQuestion,
} from "../../../api/quizzes";

function gradeColor(grade: string | null, pct: number | null): "success" | "warning" | "error" | "default" {
  if (!pct) return "default";
  if (pct >= 70) return "success";
  if (pct >= 50) return "warning";
  return "error";
}

function QuestionReview({ q, index }: { q: ReviewQuestion; index: number }) {
  const selectedOpt = q.options.find((o) => o.id === q.selected_option_id);
  const correctOpt = q.options.find((o) => o.is_correct);

  return (
    <Box sx={{ mb: 2.5 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ mb: 1.5 }}>
        <Box
          sx={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            bgcolor: q.is_correct ? "success.main" : q.is_correct === false ? "error.main" : "action.disabledBackground",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 13, fontWeight: 700,
          }}
        >
          {index + 1}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {q.question_text}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {q.marks} mark{q.marks !== 1 ? "s" : ""}{q.marks_awarded !== null ? ` · Got: ${q.marks_awarded}` : ""}
          </Typography>
        </Box>
        {q.is_correct !== null && (
          q.is_correct
            ? <CheckCircleIcon color="success" sx={{ flexShrink: 0, mt: 0.25 }} />
            : <CancelIcon color="error" sx={{ flexShrink: 0, mt: 0.25 }} />
        )}
      </Stack>

      <Stack spacing={0.75} sx={{ pl: 5 }}>
        {q.options.map((opt) => {
          const isSelected = opt.id === q.selected_option_id;
          const isCorrect = opt.is_correct;
          let bgcolor = "transparent";
          let borderColor = "divider";
          if (isCorrect) { bgcolor = "success.50"; borderColor = "success.main"; }
          else if (isSelected && !isCorrect) { bgcolor = "error.50"; borderColor = "error.main"; }

          return (
            <Stack
              key={opt.id}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                p: 0.75,
                borderRadius: 1,
                border: "1px solid",
                borderColor,
                bgcolor,
              }}
            >
              {isCorrect
                ? <CheckCircleIcon sx={{ fontSize: 15, color: "success.main", flexShrink: 0 }} />
                : isSelected
                  ? <CancelIcon sx={{ fontSize: 15, color: "error.main", flexShrink: 0 }} />
                  : <RadioButtonUncheckedIcon sx={{ fontSize: 15, color: "action.disabled", flexShrink: 0 }} />
              }
              <Typography variant="body2" sx={{ flex: 1 }}>{opt.option_text}</Typography>
              {isCorrect && (
                <Typography variant="caption" color="success.main" fontWeight={600}>Correct</Typography>
              )}
              {isSelected && !isCorrect && (
                <Typography variant="caption" color="error.main" fontWeight={600}>Your answer</Typography>
              )}
            </Stack>
          );
        })}
      </Stack>

      {q.answer_text && (
        <Box sx={{ pl: 5, mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Your written answer: <em>{q.answer_text}</em>
          </Typography>
        </Box>
      )}

      {selectedOpt && !selectedOpt.is_correct && correctOpt && (
        <Box sx={{ pl: 5, mt: 0.5 }}>
          <Typography variant="caption" color="success.main">
            ✓ Correct answer: {correctOpt.option_text}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function ReviewDialog({ attempt, open, onClose }: { attempt: MyAttemptHistoryEntry; open: boolean; onClose: () => void }) {
  const reviewQuery = useQuery({
    queryKey: ["attempt-review", attempt.id],
    queryFn: () => getAttemptReview(attempt.id),
    enabled: open,
  });

  const review = reviewQuery.data;
  const correct = review?.questions.filter((q) => q.is_correct === true).length ?? 0;
  const total = review?.questions.length ?? 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h6" fontWeight={700}>{attempt.quiz_title}</Typography>
            <Typography variant="caption" color="text.secondary">
              Submitted {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            </Typography>
          </Box>
          {review && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`${review.score ?? 0} / ${review.max_score}`}
                color={gradeColor(review.grade, review.percentage)}
                size="small"
                sx={{ fontWeight: 700 }}
              />
              {review.grade && (
                <Chip label={`Grade ${review.grade}`} variant="outlined" size="small" />
              )}
            </Stack>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {reviewQuery.isLoading && (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Loading review…</Typography>
          </Stack>
        )}

        {reviewQuery.isError && (
          <Alert severity="error">Could not load review. Please try again.</Alert>
        )}

        {review && (
          <>
            <Stack direction="row" spacing={3} sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4" fontWeight={800} color={gradeColor(review.grade, review.percentage) + ".main"}>
                  {review.percentage !== null ? `${Math.round(review.percentage)}%` : "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary">Score</Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4" fontWeight={800} color="success.main">{correct}</Typography>
                <Typography variant="caption" color="text.secondary">Correct</Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4" fontWeight={800} color="error.main">{total - correct}</Typography>
                <Typography variant="caption" color="text.secondary">Wrong</Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4" fontWeight={800}>{total}</Typography>
                <Typography variant="caption" color="text.secondary">Total</Typography>
              </Box>
            </Stack>

            <Divider sx={{ mb: 2.5 }} />
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11 }}>
              Question Review
            </Typography>

            {review.questions
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((q, i) => (
                <Box key={q.id}>
                  <QuestionReview q={q} index={i} />
                  {i < review.questions.length - 1 && <Divider sx={{ mb: 2 }} />}
                </Box>
              ))}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export function QuizHistoryPage() {
  const [reviewAttempt, setReviewAttempt] = useState<MyAttemptHistoryEntry | null>(null);

  const historyQuery = useQuery({
    queryKey: ["my-quiz-attempts"],
    queryFn: listMyAttempts,
  });

  const attempts = (historyQuery.data ?? [])
    .filter((a) => a.status === "submitted" || a.status === "graded")
    .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));

  return (
    <AppShell navItems={studentNavItems} title="Quiz Results">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <HistoryIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Quiz Results</Typography>
            <Typography variant="body2" color="text.secondary">
              All your past quiz attempts with scores and detailed review
            </Typography>
          </Box>
        </Stack>

        {historyQuery.isLoading && (
          <Typography color="text.secondary">Loading quiz history…</Typography>
        )}

        {!historyQuery.isLoading && attempts.length === 0 && (
          <Alert severity="info">
            No quiz results yet. Complete a quiz and your results will appear here.
          </Alert>
        )}

        {attempts.length > 0 && (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table>
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Quiz</TableCell>
                  <TableCell align="center">Score</TableCell>
                  <TableCell align="center">%</TableCell>
                  <TableCell align="center">Grade</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Review</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{a.quiz_title}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontVariantNumeric="tabular-nums">
                        {a.score ?? "—"} / {a.max_score}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {a.percentage !== null ? (
                        <Chip
                          size="small"
                          label={`${Math.round(a.percentage)}%`}
                          color={gradeColor(a.grade, a.percentage)}
                          sx={{ fontWeight: 700, minWidth: 56 }}
                        />
                      ) : "—"}
                    </TableCell>
                    <TableCell align="center">
                      {a.grade
                        ? <Chip size="small" label={a.grade} variant="outlined" />
                        : <Typography variant="body2" color="text.secondary">—</Typography>
                      }
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {a.submitted_at
                          ? new Date(a.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setReviewAttempt(a)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>

      {reviewAttempt && (
        <ReviewDialog
          attempt={reviewAttempt}
          open={!!reviewAttempt}
          onClose={() => setReviewAttempt(null)}
        />
      )}
    </AppShell>
  );
}
