import type { ReactNode } from "react";
import { Button, Stack, Typography } from "@mui/material";

export const MONTHS = [
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

export function fmtMoney(value: number | null | undefined): string {
  return value == null ? "—" : `Rs ${Number(value).toLocaleString()}`;
}

/** Empty-string-to-null for optional text fields sent to the API. */
export const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
      <Typography variant="h4">{title}</Typography>
      {action}
    </Stack>
  );
}

export function TabButtons<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Button
            key={o.value}
            size="small"
            variant={selected ? "contained" : "outlined"}
            onClick={() => onChange(o.value)}
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
