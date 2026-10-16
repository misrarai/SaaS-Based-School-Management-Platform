import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { listDiary } from "../../../api/communication";
import { listClasses } from "../../../api/classes";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function sevenDaysAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}
function formatDate(iso: string) {
  const today = todayIso();
  if (iso === today) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export function StudentHomeworkPage() {
  const [classFilter, setClassFilter] = useState("");

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const diary = useQuery({
    queryKey: ["diary", "student", classFilter],
    queryFn: () => listDiary({
      class_grade_id: classFilter || undefined,
      date_from: sevenDaysAgoIso(),
      date_to: todayIso(),
    }),
  });

  const list = (diary.data ?? []).sort(
    (a, b) => new Date(b.diary_date).getTime() - new Date(a.diary_date).getTime()
  );

  // Group by date
  const grouped = list.reduce<Record<string, typeof list>>((acc, entry) => {
    const key = entry.diary_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <AppShell navItems={studentNavItems} title="Homework">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <AssignmentIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Homework Diary</Typography>
            <Typography variant="body2" color="text.secondary">
              Daily homework posted by your teachers — last 7 days
            </Typography>
          </Box>
        </Stack>

        {/* Class filter */}
        <FormControl size="small" sx={{ maxWidth: 200 }}>
          <InputLabel>Filter by Class</InputLabel>
          <Select value={classFilter} label="Filter by Class" onChange={(e) => setClassFilter(e.target.value)}>
            <MenuItem value="">All Classes</MenuItem>
            {(classes.data ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {!diary.isLoading && list.length === 0 && (
          <Alert severity="info">No homework posted in the last 7 days. Enjoy! 🎉</Alert>
        )}

        {/* Grouped by date */}
        {dates.map((date) => (
          <Box key={date}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{
                mb: 1,
                color: date === todayIso() ? "primary.main" : "text.secondary",
                display: "flex", alignItems: "center", gap: 1,
              }}
            >
              {date === todayIso() && "📌 "}
              {formatDate(date)}
            </Typography>
            <Stack spacing={1.5}>
              {grouped[date].map((entry) => (
                <Card
                  key={entry.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: date === todayIso() ? "primary.light" : "divider",
                  }}
                >
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                      <Stack spacing={0.5} sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {entry.subject_name && (
                            <Chip size="small" label={entry.subject_name} color="primary" variant="outlined" />
                          )}
                          {entry.class_name && (
                            <Chip size="small" label={entry.class_name} variant="outlined" />
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                          {entry.homework}
                        </Typography>
                      </Stack>
                    </Stack>
                    {entry.posted_by_name && (
                      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
                        Posted by {entry.posted_by_name}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </AppShell>
  );
}
