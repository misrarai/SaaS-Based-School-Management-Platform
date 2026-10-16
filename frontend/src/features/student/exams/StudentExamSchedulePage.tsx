import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import EventIcon from "@mui/icons-material/EventOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTimeOutlined";
import RoomIcon from "@mui/icons-material/RoomOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { listMyExams, getDatesheet, type DatesheetEntry, type MyExam } from "../../../api/exams";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(+h, +m);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function CountdownChip({ days }: { days: number }) {
  if (days < 0) return <Chip size="small" label="Completed" icon={<CheckCircleIcon />} color="default" />;
  if (days === 0) return <Chip size="small" label="TODAY" color="error" sx={{ fontWeight: 700 }} />;
  if (days === 1) return <Chip size="small" label="Tomorrow" color="warning" />;
  if (days <= 7) return <Chip size="small" label={`${days} days`} color="warning" />;
  return <Chip size="small" label={`${days} days`} color="success" />;
}

function ExamCard({ exam, entries }: { exam: { exam_name: string; start_date: string | null; end_date: string | null }; entries: DatesheetEntry[] }) {
  const upcoming = entries.filter((e) => e.exam_date && daysUntil(e.exam_date)! >= 0)
    .sort((a, b) => (a.exam_date ?? "").localeCompare(b.exam_date ?? ""));
  const past = entries.filter((e) => e.exam_date && daysUntil(e.exam_date)! < 0)
    .sort((a, b) => (b.exam_date ?? "").localeCompare(a.exam_date ?? ""));

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>{exam.exam_name}</Typography>
            {(exam.start_date || exam.end_date) && (
              <Typography variant="caption" color="text.secondary">
                {formatDate(exam.start_date)}{exam.end_date ? ` → ${formatDate(exam.end_date)}` : ""}
              </Typography>
            )}
          </Box>
          <Chip size="small" label={`${entries.length} subject${entries.length !== 1 ? "s" : ""}`} variant="outlined" />
        </Stack>

        {entries.length === 0 && (
          <Alert severity="info">Datesheet not released yet for this exam.</Alert>
        )}

        {upcoming.length > 0 && (
          <>
            <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5 }}>
              Upcoming
            </Typography>
            <Grid container spacing={1.5} sx={{ mb: past.length > 0 ? 2 : 0 }}>
              {upcoming.map((e) => {
                const days = daysUntil(e.exam_date);
                return (
                  <Grid item xs={12} sm={6} md={4} key={e.id}>
                    <Box
                      sx={{
                        border: "1.5px solid",
                        borderColor: days === 0 ? "error.main" : days !== null && days <= 7 ? "warning.main" : "divider",
                        borderRadius: 1.5,
                        p: 1.5,
                        bgcolor: days === 0 ? "error.50" : "background.paper",
                      }}
                    >
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>{e.subject_name}</Typography>
                        {days !== null && <CountdownChip days={days} />}
                      </Stack>
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <EventIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">{formatDate(e.exam_date)}</Typography>
                        </Stack>
                        {e.start_time && (
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <AccessTimeIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(e.start_time)}{e.end_time ? ` – ${formatTime(e.end_time)}` : ""}
                            </Typography>
                          </Stack>
                        )}
                        {e.room && (
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <RoomIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                            <Typography variant="caption" color="text.secondary">Room {e.room}</Typography>
                          </Stack>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Total: {e.total_marks} marks · Pass: {e.passing_marks}
                        </Typography>
                      </Stack>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </>
        )}

        {past.length > 0 && (
          <>
            {upcoming.length > 0 && <Divider sx={{ my: 2 }} />}
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
              Completed
            </Typography>
            <Stack spacing={0.75}>
              {past.map((e) => (
                <Stack key={e.id} direction="row" alignItems="center" spacing={2} sx={{ py: 0.5 }}>
                  <CheckCircleIcon sx={{ fontSize: 16, color: "success.main", flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{e.subject_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatDate(e.exam_date)}</Typography>
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ExamWithDatesheet({ exam }: { exam: MyExam }) {
  const datesheetQuery = useQuery({
    queryKey: ["datesheet-student", exam.exam_id],
    queryFn: () => getDatesheet(exam.exam_id, { student_id: exam.student_id }),
  });

  return (
    <ExamCard
      exam={{ exam_name: exam.exam_name, start_date: exam.start_date, end_date: exam.end_date }}
      entries={datesheetQuery.data ?? []}
    />
  );
}

export function StudentExamSchedulePage() {
  const examsQuery = useQuery({
    queryKey: ["my-exams"],
    queryFn: listMyExams,
  });

  const exams = examsQuery.data ?? [];
  const published = exams.filter((e) => e.status === "published");

  return (
    <AppShell navItems={studentNavItems} title="Exam Schedule">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <EventIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Exam Schedule</Typography>
            <Typography variant="body2" color="text.secondary">
              Your upcoming exams with dates, times, and rooms
            </Typography>
          </Box>
        </Stack>

        {examsQuery.isLoading && (
          <Typography color="text.secondary">Loading exam schedule…</Typography>
        )}

        {!examsQuery.isLoading && published.length === 0 && (
          <Alert severity="info">
            No exams are published yet. Check back later — your teacher or admin will release the datesheet soon.
          </Alert>
        )}

        {published.map((exam) => (
          <ExamWithDatesheet key={exam.exam_id} exam={exam} />
        ))}
      </Stack>
    </AppShell>
  );
}
