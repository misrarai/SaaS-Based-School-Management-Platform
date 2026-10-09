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
      { label: "Courses", to: "/admin/courses" },
      { label: "Academic Years", to: "/admin/academic-years" },
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
    label: "Front Office",
    to: "/admin/front-office/enquiries",
    icon: <BadgeIcon fontSize="small" />,
    children: [
      { label: "Admission Enquiries", to: "/admin/front-office/enquiries" },
      { label: "Visitor Book", to: "/admin/front-office/visitors" },
      { label: "Complaints", to: "/admin/front-office/complaints" },
      { label: "Postal Register", to: "/admin/front-office/postal" },
      { label: "Gate Passes", to: "/admin/front-office/gate-passes" },
      { label: "Phone Call Log", to: "/admin/front-office/calls" },
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
    label: "Examinations",
    to: "/admin/exams",
    icon: <FactCheckIcon fontSize="small" />,
    children: [
      { label: "Exams & Datesheets", to: "/admin/exams" },
      { label: "Grading Schemes", to: "/admin/exams/grading-schemes" },
      { label: "Marks Entry", to: "/admin/exams/marks" },
      { label: "Results / Tabulation", to: "/admin/exams/results" },
    ],
  },
  {
    label: "Library",
    to: "/admin/library",
    icon: <ClassIcon fontSize="small" />,
    children: [
      { label: "Catalogue", to: "/admin/library" },
      { label: "Issue / Return Desk", to: "/admin/library/circulation" },
      { label: "Reservations", to: "/admin/library/reservations" },
      { label: "Overdue & Fines", to: "/admin/library/fines" },
      { label: "Library Settings", to: "/admin/library/settings" },
    ],
  },
  {
    label: "Transport",
    to: "/admin/transport/vehicles",
    icon: <EventIcon fontSize="small" />,
    children: [
      { label: "Vehicles", to: "/admin/transport/vehicles" },
      { label: "Drivers", to: "/admin/transport/drivers" },
      { label: "Routes & Stops", to: "/admin/transport/routes" },
      { label: "Student Allocation", to: "/admin/transport/allocations" },
      { label: "Transport Fees", to: "/admin/transport/fees" },
      { label: "Transport Reports", to: "/admin/transport/reports" },
    ],
  },
  {
    label: "Hostel",
    to: "/admin/hostel",
    icon: <ClassIcon fontSize="small" />,
    children: [
      { label: "Hostels & Rooms", to: "/admin/hostel" },
      { label: "Allocations", to: "/admin/hostel/allocations" },
    ],
  },
  {
    label: "Accounting",
    to: "/admin/accounting/accounts",
    icon: <PaymentsIcon fontSize="small" />,
    children: [
      { label: "Chart of Accounts", to: "/admin/accounting/accounts" },
      { label: "Income & Expenses", to: "/admin/accounting/income-expenses" },
      { label: "Vouchers", to: "/admin/accounting/vouchers" },
    ],
  },
  {
    label: "Payroll & Leaves",
    to: "/admin/payroll/employees",
    icon: <PaidIcon fontSize="small" />,
    children: [
      { label: "Employees", to: "/admin/payroll/employees" },
      { label: "Departments & Designations", to: "/admin/payroll/departments" },
      { label: "Salary Structures", to: "/admin/payroll/salary-structures" },
      { label: "Leave Requests", to: "/admin/payroll/leaves" },
      { label: "Leave Types", to: "/admin/payroll/leave-types" },
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
