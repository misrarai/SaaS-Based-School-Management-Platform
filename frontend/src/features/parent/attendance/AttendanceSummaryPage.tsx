import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, Chip, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { listMyChildren } from "../../../api/parents";
import { getStudentSummary } from "../../../api/attendance";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function AttendanceSummaryPage() {
  const childrenQuery = useQuery({ queryKey: ["parents", "me", "children"], queryFn: listMyChildren });
  const today = new Date();
  const [studentId, setStudentId] = useState("");
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const effectiveStudentId = studentId || childrenQuery.data?.[0]?.id || "";

  const summaryQuery = useQuery({
    queryKey: ["attendance-summary", effectiveStudentId, month, year],
    queryFn: () => getStudentSummary(effectiveStudentId, month, year),
    enabled: !!effectiveStudentId,
  });

  return (
    <AppShell title="Attendance" navItems={parentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Attendance
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="child-label">Child</InputLabel>
          <Select
            labelId="child-label"
            label="Child"
            value={effectiveStudentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            {childrenQuery.data?.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.full_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="month-label">Month</InputLabel>
          <Select labelId="month-label" label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_LABELS.map((label, i) => (
              <MenuItem key={label} value={i + 1}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="year-label">Year</InputLabel>
          <Select labelId="year-label" label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {summaryQuery.data && (
        <Card variant="outlined" sx={{ borderRadius: 2, maxWidth: 420 }}>
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
              {summaryQuery.data.percentage}%
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip label={`Present: ${summaryQuery.data.present}`} color="success" />
              <Chip label={`Absent: ${summaryQuery.data.absent}`} color="error" />
              <Chip label={`Late: ${summaryQuery.data.late}`} color="warning" />
              <Chip label={`Excused: ${summaryQuery.data.excused}`} />
            </Stack>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
