import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { listClasses, listSections } from "../../../api/classes";
import { getAnalytics } from "../../../api/attendance";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function AttendanceAnalyticsPage() {
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const sectionsQuery = useQuery({
    queryKey: ["sections", classGradeId],
    queryFn: () => listSections(classGradeId),
    enabled: !!classGradeId,
  });

  const analyticsQuery = useQuery({
    queryKey: ["attendance-analytics", classGradeId, sectionId, dateFrom, dateTo],
    queryFn: () =>
      getAnalytics({
        classGradeId: classGradeId || undefined,
        sectionId: sectionId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  return (
    <AppShell title="Attendance Analytics" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Attendance Analytics
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="class-label">Class (optional)</InputLabel>
            <Select
              labelId="class-label"
              label="Class (optional)"
              value={classGradeId}
              onChange={(e) => {
                setClassGradeId(e.target.value);
                setSectionId("");
              }}
            >
              <MenuItem value="">All classes</MenuItem>
              {classesQuery.data?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }} disabled={!classGradeId}>
            <InputLabel id="section-label">Section (optional)</InputLabel>
            <Select
              labelId="section-label"
              label="Section (optional)"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <MenuItem value="">All sections</MenuItem>
              {sectionsQuery.data?.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="From"
            type="date"
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </Paper>

      {analyticsQuery.data && analyticsQuery.data.total === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No attendance records match these filters yet.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Present" value={analyticsQuery.data?.present ?? "…"} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Absent" value={analyticsQuery.data?.absent ?? "…"} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Late" value={analyticsQuery.data?.late ?? "…"} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Excused" value={analyticsQuery.data?.excused ?? "…"} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <StatCard label="Attendance %" value={analyticsQuery.data ? `${analyticsQuery.data.percentage}%` : "…"} />
        </Grid>
      </Grid>
    </AppShell>
  );
}
