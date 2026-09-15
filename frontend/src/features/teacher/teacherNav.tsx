import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import GroupIcon from "@mui/icons-material/GroupOutlined";
import EventIcon from "@mui/icons-material/EventOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import QuizIcon from "@mui/icons-material/QuizOutlined";
import GradingIcon from "@mui/icons-material/GradingOutlined";
import FolderIcon from "@mui/icons-material/FolderOutlined";
import VideoCameraFrontIcon from "@mui/icons-material/VideoCameraFrontOutlined";
import PaidIcon from "@mui/icons-material/PaidOutlined";
import type { NavItem } from "../../components/AppShell";

export const teacherNavItems: NavItem[] = [
  { label: "Dashboard", to: "/teacher", icon: <DashboardIcon fontSize="small" /> },
  { label: "My Classes", to: "/teacher/classes", icon: <ClassIcon fontSize="small" /> },
  { label: "My Students", to: "/teacher/students", icon: <GroupIcon fontSize="small" /> },
  { label: "Schedule", to: "/teacher/timetable", icon: <EventIcon fontSize="small" /> },
  { label: "Attendance", to: "/teacher/attendance", icon: <FactCheckIcon fontSize="small" /> },
  { label: "My Attendance", to: "/teacher/my-attendance", icon: <FactCheckIcon fontSize="small" /> },
  { label: "Assignments", to: "/teacher/assignments", icon: <AssignmentIcon fontSize="small" /> },
  { label: "Exams", to: "/teacher/quizzes", icon: <QuizIcon fontSize="small" /> },
  { label: "Gradebook", to: "/teacher/gradebook", icon: <GradingIcon fontSize="small" /> },
  { label: "Resources", to: "/teacher/resources", icon: <FolderIcon fontSize="small" /> },
  { label: "Live Classes", to: "/teacher/live-classes", icon: <VideoCameraFrontIcon fontSize="small" /> },
  { label: "My Payouts", to: "/teacher/payouts", icon: <PaidIcon fontSize="small" /> },
];
