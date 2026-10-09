import type { ReactNode } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminModuleNav } from "../../communicationNav";

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Converts a datetime-local input value to an ISO string with the browser's offset. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length && typeof detail[0]?.msg === "string") return detail[0].msg;
  return fallback;
}

export function FrontOfficeShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell title={`Front Office — ${title}`} navItems={adminModuleNav}>
      {children}
    </AppShell>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
      <Typography variant="h4">{title}</Typography>
      {action}
    </Stack>
  );
}

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Button
            key={o.value}
            onClick={() => onChange(o.value)}
            variant={selected ? "contained" : "outlined"}
            size="small"
            sx={{
              borderRadius: 1,
              bgcolor: selected ? "#0e3550" : "#fff",
              color: selected ? "#fff" : "text.primary",
              borderColor: "#d0d5dd",
              "&:hover": { bgcolor: selected ? "#0e3550" : "#f5f5f5", borderColor: "#d0d5dd" },
            }}
          >
            {o.label}
          </Button>
        );
      })}
    </Stack>
  );
}

export function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 140, flex: "1 1 140px" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ fontSize: 28, fontWeight: 700, color: color ?? "text.primary" }}>{value}</Box>
    </Paper>
  );
}
