import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import EventBusyIcon from "@mui/icons-material/EventBusyOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLongOutlined";
import type { NavItem } from "../components/AppShell";
import { adminNavItems } from "./admin/adminNav";
import { teacherNavItems } from "./teacher/teacherNav";

export const payrollAdminNav: NavItem = {
  label: "Payroll & Leaves",
  to: "/admin/payroll/employees",
  icon: <AccountBalanceWalletIcon fontSize="small" />,
  children: [
    { label: "Employees", to: "/admin/payroll/employees" },
    { label: "Departments & Designations", to: "/admin/payroll/departments" },
    { label: "Salary Structures", to: "/admin/payroll/salary-structures" },
    { label: "Leave Requests", to: "/admin/payroll/leaves" },
    { label: "Leave Types", to: "/admin/payroll/leave-types" },
  ],
};

export const payrollTeacherNav: NavItem[] = [
  { label: "My Leaves", to: "/teacher/leaves", icon: <EventBusyIcon fontSize="small" /> },
  { label: "My Payslips", to: "/teacher/payslips", icon: <ReceiptLongIcon fontSize="small" /> },
];

/** Appends the payroll nav to the role's base nav unless the integrator already merged it in. */
function merge(base: NavItem[], extra: NavItem[]): NavItem[] {
  const seen = new Set(base.map((i) => i.to));
  return [...base, ...extra.filter((i) => !seen.has(i.to))];
}

export const adminNavWithPayroll = () => merge(adminNavItems, [payrollAdminNav]);
export const teacherNavWithPayroll = () => merge(teacherNavItems, payrollTeacherNav);
