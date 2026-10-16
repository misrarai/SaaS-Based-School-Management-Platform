import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Paper, Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { getClassesOverview } from "../../../api/classes";
import { listTeachers } from "../../../api/teachers";

export { PageHeader, FilterBar, DateField, apiErrorMessage, todayIso } from "../accounting/common";

export function LmsShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell title={`LMS — ${title}`} navItems={adminNavItems}>
      {children}
    </AppShell>
  );
}

export interface AcademicRef {
  name: string;
  className: string;
  classId: string;
}

/** Loads classes (with sections + subjects) and teachers, and builds id→label lookups. */
export function useAcademics() {
  const classes = useQuery({ queryKey: ["lms-classes-overview"], queryFn: getClassesOverview });
  const teachers = useQuery({ queryKey: ["lms-teachers"], queryFn: () => listTeachers() });

  const overview = classes.data ?? [];
  const sectionMap = new Map<string, AcademicRef>();
  const subjectMap = new Map<string, AcademicRef>();
  for (const c of overview) {
    for (const s of c.sections) sectionMap.set(s.id, { name: s.name, className: c.name, classId: c.id });
    for (const su of c.subjects) subjectMap.set(su.id, { name: su.name, className: c.name, classId: c.id });
  }
  const teacherList = teachers.data ?? [];
  const teacherMap = new Map<string, string>();
  for (const t of teacherList) teacherMap.set(t.id, t.full_name);

  return {
    overview,
    teachers: teacherList,
    sectionMap,
    subjectMap,
    teacherMap,
    sectionLabel: (id: string) => {
      const s = sectionMap.get(id);
      return s ? `${s.className} · ${s.name}` : "—";
    },
    subjectLabel: (id: string) => subjectMap.get(id)?.name ?? "—",
    teacherLabel: (id: string) => teacherMap.get(id) ?? "—",
    isLoading: classes.isLoading || teachers.isLoading,
  };
}

export function StatTile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: "1 1 150px", minWidth: 150 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ fontSize: 28, fontWeight: 700, color: color ?? "text.primary" }}>{value}</Box>
    </Paper>
  );
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
