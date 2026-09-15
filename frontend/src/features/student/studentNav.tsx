import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import EventIcon from "@mui/icons-material/EventOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import FolderIcon from "@mui/icons-material/FolderOutlined";
import QuizIcon from "@mui/icons-material/QuizOutlined";
import type { NavItem } from "../../components/AppShell";

export const studentNavItems: NavItem[] = [
  { label: "Dashboard", to: "/student", icon: <DashboardIcon fontSize="small" /> },
  { label: "Timetable", to: "/student/timetable", icon: <EventIcon fontSize="small" /> },
  { label: "Resource Center", to: "/student/resources", icon: <FolderIcon fontSize="small" /> },
  { label: "Assignments", to: "/student/assignments", icon: <AssignmentIcon fontSize="small" /> },
  { label: "Quizzes", to: "/student/quizzes", icon: <QuizIcon fontSize="small" /> },
];
