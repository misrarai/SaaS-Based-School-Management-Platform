import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Avatar, Box, Card, CardContent, Chip, Divider, Link, Stack, Typography } from "@mui/material";
import { AppShell } from "../../components/AppShell";
import { parentNavItems } from "./parentNav";
import { listMyChildren } from "../../api/parents";
import { listSessions, type ClassSession } from "../../api/schedule";
import { getStudentSummary } from "../../api/attendance";
import { listInvoices, type Invoice } from "../../api/fees";
import { getGradebook, getSubjectPerformance } from "../../api/assignments";
import { getProgress } from "../../api/progress";
import type { Student } from "../../api/students";

const EMPTY_CHILDREN: Student[] = [];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function sessionStart(session: ClassSession) {
  return new Date(`${session.session_date}T${session.start_time}`);
}

function friendlyDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function friendlyDateTime(iso: string, time: string) {
  const when = new Date(`${iso}T${time}`);
  const isToday = iso === todayIso();
  const day = isToday ? "Today" : when.toLocaleDateString("en-GB", { weekday: "long" });
  const clock = when.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${clock}`;
}

function attendanceColor(percent: number): "success" | "warning" | "error" {
  if (percent >= 90) return "success";
  if (percent >= 75) return "warning";
  return "error";
}

function performanceColor(percent: number): "success" | "warning" | "error" {
  if (percent >= 70) return "success";
  if (percent >= 40) return "warning";
  return "error";
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function pickFeeSummary(invoices: Invoice[], childId: string) {
  const tuition = invoices.filter((inv) => inv.student_id === childId && inv.invoice_type === "tuition");
  if (tuition.length === 0) return null;

  // "Status" reflects the current/most-recently-due period, not whichever invoice happens to
  // have the furthest-future due date — an admin may already have generated next month's
  // invoice ahead of time, which "Next Due" (any still-unpaid invoice, soonest first) covers
  // separately. These can end up being two different invoices.
  const today = todayIso();
  const dueOrPast = tuition.filter((inv) => inv.due_date <= today).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const current = dueOrPast[0] ?? [...tuition].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const nextDue = tuition
    .filter((inv) => inv.status === "pending" || inv.status === "overdue")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  return { current, nextDueDate: nextDue?.due_date ?? null };
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.5 }}>
      {children}
    </Typography>
  );
}

export function ParentDashboard() {
  const childrenQuery = useQuery({ queryKey: ["parents", "me", "children"], queryFn: listMyChildren });
  const children = childrenQuery.data ?? EMPTY_CHILDREN;
  const today = new Date();

  const summaryQueries = useQueries({
    queries: children.map((c) => ({
      queryKey: ["attendance-summary", c.id, today.getMonth() + 1, today.getFullYear()],
      queryFn: () => getStudentSummary(c.id, today.getMonth() + 1, today.getFullYear()),
    })),
  });

  const performanceQueries = useQueries({
    queries: children.map((c) => ({
      queryKey: ["subject-performance", c.id],
      queryFn: () => getSubjectPerformance(c.id),
    })),
  });

  const gradebookQueries = useQueries({
    queries: children.map((c) => ({
      queryKey: ["gradebook", c.id],
      queryFn: () => getGradebook(c.id),
    })),
  });

  const progressQueries = useQueries({
    queries: children.map((c) => ({
      queryKey: ["progress", c.id],
      queryFn: () => getProgress(c.id),
    })),
  });

  const sessionQueries = useQueries({
    queries: children.map((c) => ({
      queryKey: ["schedule-sessions", "parent-child", c.id, c.section_id],
      queryFn: () => listSessions({ sectionId: c.section_id ?? undefined, dateFrom: todayIso(), dateTo: addDaysIso(7) }),
      enabled: !!c.section_id,
    })),
  });

  const invoicesQuery = useQuery({ queryKey: ["fees-invoices", "parent"], queryFn: () => listInvoices() });

  const feeSummaryByChild = useMemo(() => {
    const invoices = invoicesQuery.data ?? [];
    return Object.fromEntries(children.map((c) => [c.id, pickFeeSummary(invoices, c.id)]));
  }, [invoicesQuery.data, children]);

  return (
    <AppShell title="My Children" navItems={parentNavItems}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        My Children
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        A quick look at how each child is doing.
      </Typography>

      {children.length === 0 && !childrenQuery.isLoading && (
        <Alert severity="info">No children linked to your account yet — ask the academy office to link them.</Alert>
      )}

      <Stack spacing={3}>
        {children.map((child, i) => {
          const attendance = summaryQueries[i]?.data;
          const performance = performanceQueries[i]?.data ?? [];
          const gradedCount = gradebookQueries[i]?.data?.length ?? 0;
          const progress = progressQueries[i]?.data;
          const earnedBadges = (progress?.badges ?? []).filter((b) => b.achieved);
          const fee = feeSummaryByChild[child.id];
          const sessions = sessionQueries[i]?.data ?? [];
          const nextSession = [...sessions].sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime())[0];

          return (
            <Card key={child.id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 3 }}>
                  <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.main", fontSize: 20, fontWeight: 700 }}>
                    {initialsOf(child.full_name)}
                  </Avatar>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {child.full_name}
                  </Typography>
                </Stack>

                <Stack spacing={3} divider={<Divider />}>
                  {/* Attendance */}
                  <Box>
                    <SectionLabel>Attendance</SectionLabel>
                    {attendance ? (
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", mt: 0.5 }}>
                        <Typography variant="h3" sx={{ fontWeight: 700 }}>
                          {attendance.percentage}%
                        </Typography>
                        <Chip
                          size="small"
                          color={attendanceColor(attendance.percentage)}
                          label={attendance.percentage >= 90 ? "Great" : attendance.percentage >= 75 ? "Okay" : "Needs attention"}
                        />
                      </Stack>
                    ) : (
                      <Typography color="text.secondary">No attendance recorded yet.</Typography>
                    )}
                  </Box>

                  {/* Performance / Marks */}
                  <Box>
                    <SectionLabel>Performance</SectionLabel>
                    {performance.length === 0 ? (
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        No marks recorded yet.
                      </Typography>
                    ) : (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        {performance.map((p) => (
                          <Stack key={p.subject_id} direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                            <Typography>{p.subject_name}</Typography>
                            <Chip
                              size="small"
                              color={p.average_percent !== null ? performanceColor(p.average_percent) : "default"}
                              label={p.average_percent !== null ? `${p.average_percent}%` : "—"}
                              sx={{ fontWeight: 600, minWidth: 56 }}
                            />
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </Box>

                  {/* Assignments */}
                  <Box>
                    <SectionLabel>Assignments</SectionLabel>
                    <Typography sx={{ mt: 0.5 }}>
                      {gradedCount === 0
                        ? "No homework graded yet."
                        : `${gradedCount} assignment${gradedCount === 1 ? "" : "s"} graded so far.`}{" "}
                      <Link component={RouterLink} to="/parent/gradebook">
                        View details
                      </Link>
                    </Typography>
                  </Box>

                  {/* Progress */}
                  <Box>
                    <SectionLabel>Progress</SectionLabel>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Typography>
                        {earnedBadges.length > 0 ? "Doing great this term!" : "Keep going — new badges are on the way."}
                      </Typography>
                      {earnedBadges.map((b) => (
                        <Chip key={b.code} size="small" color="secondary" label={b.label} />
                      ))}
                    </Stack>
                  </Box>

                  {/* Fees */}
                  <Box>
                    <SectionLabel>Fees</SectionLabel>
                    {fee ? (
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        <Typography>
                          Monthly Fee: <b>PKR {fee.current.net_amount.toLocaleString()}</b>
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Typography>Status:</Typography>
                          <Chip
                            size="small"
                            label={fee.current.status === "paid" ? "Paid" : fee.current.status === "overdue" ? "Overdue" : "Pending"}
                            color={fee.current.status === "paid" ? "success" : fee.current.status === "overdue" ? "error" : "warning"}
                          />
                        </Stack>
                        {fee.nextDueDate && <Typography>Next Due: {friendlyDate(fee.nextDueDate)}</Typography>}
                        <Link component={RouterLink} to="/parent/fees" sx={{ mt: 0.5, alignSelf: "flex-start" }}>
                          View fees &amp; receipts
                        </Link>
                      </Stack>
                    ) : (
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        No fee invoices yet.
                      </Typography>
                    )}
                  </Box>

                  {/* Schedule */}
                  <Box>
                    <SectionLabel>Schedule</SectionLabel>
                    <Typography sx={{ mt: 0.5 }}>
                      {nextSession
                        ? `Next class: ${friendlyDateTime(nextSession.session_date, nextSession.start_time)}`
                        : "No upcoming classes this week."}{" "}
                      <Link component={RouterLink} to="/parent/timetable">
                        View timetable
                      </Link>
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </AppShell>
  );
}
