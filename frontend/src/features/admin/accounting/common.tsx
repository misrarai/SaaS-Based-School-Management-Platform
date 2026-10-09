import type { ReactNode } from "react";
import { MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { Account } from "../../../api/accounting";

export function fmtMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10);
}

export function yearStartIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function apiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg;
  }
  return fallback;
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
      <Typography variant="h4">{title}</Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        {actions}
      </Stack>
    </Stack>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
        {children}
      </Stack>
    </Paper>
  );
}

export function DateField({ label, value, onChange, width = 170 }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  width?: number;
}) {
  return (
    <TextField
      size="small"
      type="date"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ width }}
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  label = "Account",
  filter,
  size = "small",
  width,
  required,
  allowEmpty,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  filter?: (a: Account) => boolean;
  size?: "small" | "medium";
  width?: number | string;
  required?: boolean;
  allowEmpty?: boolean;
}) {
  const options = accounts.filter((a) => a.is_active && (!filter || filter(a)));
  return (
    <TextField
      select
      size={size}
      label={label}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 220, width }}
    >
      {allowEmpty && <MenuItem value="">—</MenuItem>}
      {options.map((a) => (
        <MenuItem key={a.id} value={a.id}>
          {a.code} — {a.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

export const ACCOUNT_TYPE_COLORS: Record<string, "primary" | "warning" | "secondary" | "success" | "error"> = {
  asset: "primary",
  liability: "warning",
  equity: "secondary",
  income: "success",
  expense: "error",
};
