import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import GroupIcon from "@mui/icons-material/GroupOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import EventNoteIcon from "@mui/icons-material/EventNoteOutlined";
import LiveTvIcon from "@mui/icons-material/LiveTvOutlined";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import QuizIcon from "@mui/icons-material/QuizOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import GradingIcon from "@mui/icons-material/GradingOutlined";
import SendIcon from "@mui/icons-material/SendOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import AccountBoxIcon from "@mui/icons-material/AccountBoxOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTimeOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooksOutlined";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import type { NavItem } from "../../components/AppShell";

export const teacherNavItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/teacher",
    icon: <DashboardIcon fontSize="small" />,
  },
  {
    label: "My Profile",
    to: "/teacher/profile",
    icon: <AccountBoxIcon fontSize="small" />,
  },
  {
    label: "My Classes",
    to: "/teacher/classes",
    icon: <ClassIcon fontSize="small" />,
  },
  {
    label: "My Students",
    to: "/teacher/students",
    icon: <GroupIcon fontSize="small" />,
  },
  {
    label: "Timetable",
    to: "/teacher/timetable",
    icon: <CalendarMonthIcon fontSize="small" />,
  },
  {
    label: "Mark Attendance",
    to: "/teacher/attendance",
    icon: <FactCheckIcon fontSize="small" />,
  },
  {
    label: "My Attendance",
    to: "/teacher/my-attendance",
    icon: <AccessTimeIcon fontSize="small" />,
  },
  {
    label: "Live Classes",
    to: "/teacher/live",
    icon: <LiveTvIcon fontSize="small" />,
  },
  {
    label: "Video Lectures",
    to: "/teacher/videos",
    icon: <VideoLibraryIcon fontSize="small" />,
  },
  {
    label: "Resources",
    to: "/teacher/resources",
    icon: <LibraryBooksIcon fontSize="small" />,
  },
  {
    label: "Books (Upload)",
    to: "/teacher/books",
    icon: <MenuBookIcon fontSize="small" />,
  },
  {
    label: "Quizzes",
    to: "/teacher/quizzes",
    icon: <QuizIcon fontSize="small" />,
  },
  {
    label: "Assignments",
    to: "/teacher/assignments",
    icon: <AssignmentIcon fontSize="small" />,
  },
  {
    label: "Gradebook",
    to: "/teacher/gradebook",
    icon: <GradingIcon fontSize="small" />,
  },
  {
    label: "Message Parents",
    to: "/teacher/parents/message",
    icon: <SendIcon fontSize="small" />,
  },
  {
    label: "My Payouts",
    to: "/teacher/payouts",
    icon: <PaymentsIcon fontSize="small" />,
  },
];
