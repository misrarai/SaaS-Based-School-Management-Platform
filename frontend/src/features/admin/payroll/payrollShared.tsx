import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Autocomplete, Chip, Stack, TextField, Typography } from "@mui/material";
import { listEmployees, type Employee, type LeaveStatus, type PayrollStatus } from "../../../api/payroll";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
      <Typography variant="h4">{title}</Typography>
      {action}
    </Stack>
  );
}

const PAYROLL_COLORS: Record<PayrollStatus, "default" | "warning" | "success"> = {
  draft: "default",
  approved: "warning",
  paid: "success",
};

const LEAVE_COLORS: Record<LeaveStatus, "default" | "warning" | "success" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  cancelled: "default",
};

export function PayrollStatusChip({ status }: { status: PayrollStatus }) {
  return <Chip size="small" label={status} color={PAYROLL_COLORS[status]} sx={{ textTransform: "capitalize" }} />;
}

export function LeaveStatusChip({ status }: { status: LeaveStatus }) {
  return <Chip size="small" label={status} color={LEAVE_COLORS[status]} sx={{ textTransform: "capitalize" }} />;
}

export function EmployeeTypeChip({ type }: { type: Employee["employee_type"] }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={type === "teacher" ? "Teacher" : "Staff"}
      color={type === "teacher" ? "primary" : "secondary"}
    />
  );
}

export const employeeKey = (e: { employee_type: string; employee_id: string }) => `${e.employee_type}:${e.employee_id}`;

/** Autocomplete over the unified (teacher + staff) employee list. */
export function EmployeeSelect({
  value,
  onChange,
  label = "Employee",
  required,
  disabled,
}: {
  value: Employee | null;
  onChange: (employee: Employee | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const employeesQuery = useQuery({
    queryKey: ["payroll", "employees", "active", ""],
    queryFn: () => listEmployees({ status: "active" }),
  });
  return (
    <Autocomplete
      options={employeesQuery.data ?? []}
      loading={employeesQuery.isLoading}
      disabled={disabled}
      getOptionLabel={(e) => `${e.full_name} (${e.employee_type === "teacher" ? "Teacher" : e.designation_name ?? "Staff"})`}
      isOptionEqualToValue={(a, b) => employeeKey(a) === employeeKey(b)}
      value={value}
      onChange={(_, v) => onChange(v)}
      renderInput={(params) => <TextField {...params} label={label} required={required} />}
    />
  );
}
