import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import EventIcon from "@mui/icons-material/EventOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import type { NavItem } from "../../components/AppShell";

export const parentNavItems: NavItem[] = [
  { label: "Dashboard", to: "/parent", icon: <DashboardIcon fontSize="small" /> },
  { label: "Attendance", to: "/parent/attendance", icon: <FactCheckIcon fontSize="small" /> },
  { label: "Timetable", to: "/parent/timetable", icon: <EventIcon fontSize="small" /> },
  { label: "Homework & Marks", to: "/parent/gradebook", icon: <AssignmentIcon fontSize="small" /> },
  { label: "Fees & Receipts", to: "/parent/fees", icon: <PaymentsIcon fontSize="small" /> },
];
