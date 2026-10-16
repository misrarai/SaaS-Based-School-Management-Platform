import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChartOutlined";
import StarIcon from "@mui/icons-material/StarOutlined";
import EmojiEventsIcon from "@mui/icons-material/EmojiEventsOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { getGradebook, getSubjectPerformance } from "../../../api/assignments";
import { getProgress } from "../../../api/progress";

function gradeLabel(pct: number) {
  if (pct >= 90) return { grade: "A+", color: "success" as const };
  if (pct >= 80) return { grade: "A", color: "success" as const };
  if (pct >= 70) return { grade: "B", color: "primary" as const };
  if (pct >= 60) return { grade: "C", color: "warning" as const };
  if (pct >= 50) return { grade: "D", color: "warning" as const };
  return { grade: "F", color: "error" as const };
}

export function StudentProgressPage() {
  const performance = useQuery({
    queryKey: ["subject-performance", "me"],
    queryFn: () => getSubjectPerformance(),
  });

  const gradebook = useQuery({
    queryKey: ["gradebook", "me"],
    queryFn: () => getGradebook(),
  });

  const progress = useQuery({
    queryKey: ["progress", "me"],
    queryFn: () => getProgress(undefined as any),
  });

  const subjects = performance.data ?? [];
  const assignments = gradebook.data ?? [];
  const badges = (progress.data?.badges ?? []).filter((b) => b.achieved);

  // Overall average
  const withPct = subjects.filter((s) => s.average_percent !== null);
  const overallAvg =
    withPct.length > 0
      ? Math.round(withPct.reduce((sum, s) => sum + (s.average_percent ?? 0), 0) / withPct.length)
      : null;

  return (
    <AppShell navItems={studentNavItems} title="My Progress">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <BarChartIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            My Progress & Marks
          </Typography>
        </Stack>

        {/* Overall card */}
        {overallAvg !== null && (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Overall Average
              </Typography>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
                <Typography variant="h3" fontWeight={800} color={gradeLabel(overallAvg).color + ".main"}>
                  {overallAvg}%
                </Typography>
                <Chip
                  label={`Grade ${gradeLabel(overallAvg).grade}`}
                  color={gradeLabel(overallAvg).color}
                  icon={<StarIcon />}
                />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={overallAvg}
                color={gradeLabel(overallAvg).color}
                sx={{ mt: 1.5, height: 8, borderRadius: 4 }}
              />
            </CardContent>
          </Card>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              🏆 Achievements
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {badges.map((b) => (
                <Chip
                  key={b.code}
                  label={b.label}
                  color="secondary"
                  icon={<EmojiEventsIcon />}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Subject performance */}
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            📊 Performance by Subject
          </Typography>

          {subjects.length === 0 && !performance.isLoading && (
            <Alert severity="info">No marks recorded yet.</Alert>
          )}

          <Stack spacing={1.5}>
            {subjects.map((s) => {
              const pct = s.average_percent ?? 0;
              const { grade, color } = gradeLabel(pct);
              return (
                <Paper key={s.subject_id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {s.subject_name}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={`Grade ${grade}`} color={color} />
                      <Typography variant="body2" fontWeight={700}>
                        {s.average_percent !== null ? `${s.average_percent}%` : "—"}
                      </Typography>
                    </Stack>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={s.average_percent ?? 0}
                    color={color}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Paper>
              );
            })}
          </Stack>
        </Box>

        {/* Assignment marks table */}
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            📝 Assignment Results
          </Typography>

          {assignments.length === 0 && !gradebook.isLoading && (
            <Alert severity="info">No assignments graded yet.</Alert>
          )}

          {assignments.length > 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell><strong>Assignment</strong></TableCell>
                    <TableCell><strong>Subject</strong></TableCell>
                    <TableCell align="right"><strong>Marks Obtained</strong></TableCell>
                    <TableCell align="right"><strong>Total Marks</strong></TableCell>
                    <TableCell align="right"><strong>%</strong></TableCell>
                    <TableCell><strong>Feedback</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignments.map((a) => {
                    const pct =
                      a.total_marks && a.marks_obtained !== null
                        ? Math.round((a.marks_obtained / a.total_marks) * 100)
                        : null;
                    return (
                      <TableRow key={a.assignment_id} hover>
                        <TableCell>{a.title}</TableCell>
                        <TableCell>{a.subject_name || "—"}</TableCell>
                        <TableCell align="right">
                          {a.marks_obtained !== null ? a.marks_obtained : "—"}
                        </TableCell>
                        <TableCell align="right">{a.total_marks ?? "—"}</TableCell>
                        <TableCell align="right">
                          {pct !== null ? (
                            <Chip
                              size="small"
                              label={`${pct}%`}
                              color={gradeLabel(pct).color}
                            />
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {a.teacher_feedback || "—"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      </Stack>
    </AppShell>
  );
}
