import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import EventIcon from "@mui/icons-material/EventOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import PaidIcon from "@mui/icons-material/PaidOutlined";
import NotificationsIcon from "@mui/icons-material/NotificationsOutlined";
import type { NavItem } from "../../components/AppShell";

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: <DashboardIcon fontSize="small" /> },
  {
    label: "Academics",
    to: "/admin/classes",
    icon: <ClassIcon fontSize="small" />,
    children: [
      { label: "Classes & Subjects", to: "/admin/classes" },
      { label: "Teachers", to: "/admin/teachers" },
    ],
  },
  {
    label: "Students",
    to: "/admin/students",
    icon: <SchoolIcon fontSize="small" />,
    children: [
      { label: "Active Students", to: "/admin/students?status=active" },
      { label: "Family List", to: "/admin/families" },
      { label: "Admission Register", to: "/admin/students?status=all" },
      { label: "Withdrawal Register", to: "/admin/students/withdrawals" },
      { label: "Old Students", to: "/admin/students?status=old" },
      { label: "Extra Coaching", to: "/admin/students/extra-coaching" },
      { label: "Student Reports", to: "/admin/students/reports" },
      { label: "Student Certificates", to: "/admin/students/certificates" },
      { label: "Student Cards", to: "/admin/students/cards" },
    ],
  },
  {
    label: "HR / Staff",
    to: "/admin/staff",
    icon: <BadgeIcon fontSize="small" />,
    children: [
      { label: "Active Staff", to: "/admin/staff?status=active" },
      { label: "Old Staff", to: "/admin/staff?status=inactive" },
    ],
  },
  {
    label: "Schedule",
    to: "/admin/schedule",
    icon: <EventIcon fontSize="small" />,
    children: [
      { label: "Timetable", to: "/admin/schedule" },
      { label: "Online Classes", to: "/admin/schedule?create=online" },
    ],
  },
  {
    label: "Attendance",
    to: "/admin/attendance",
    icon: <FactCheckIcon fontSize="small" />,
    children: [
      { label: "Student Attendance", to: "/admin/attendance" },
      { label: "Teacher Attendance", to: "/admin/attendance/teachers" },
      { label: "Staff Attendance", to: "/admin/attendance/staff" },
    ],
  },
  {
    label: "Fees",
    to: "/admin/fees",
    icon: <PaymentsIcon fontSize="small" />,
    children: [
      { label: "Fee Plans", to: "/admin/fees" },
      { label: "Student Subscriptions", to: "/admin/fees/subscriptions" },
      { label: "Payments", to: "/admin/fees/payments/all" },
      { label: "Pending Payments", to: "/admin/fees/payments/pending" },
      { label: "Payment Verification", to: "/admin/fees/payments" },
      { label: "Receipts", to: "/admin/fees/receipts" },
      { label: "Reports", to: "/admin/fees/reports" },
    ],
  },
  {
    label: "Payouts",
    to: "/admin/payouts",
    icon: <PaidIcon fontSize="small" />,
    children: [
      { label: "Payout Rates", to: "/admin/payouts/rates" },
      { label: "Payouts", to: "/admin/payouts" },
    ],
  },
  { label: "Notifications", to: "/admin/notifications", icon: <NotificationsIcon fontSize="small" /> },
];
