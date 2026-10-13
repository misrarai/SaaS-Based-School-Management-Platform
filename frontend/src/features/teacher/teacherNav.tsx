import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import GroupIcon from "@mui/icons-material/GroupOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import LiveTvIcon from "@mui/icons-material/LiveTvOutlined";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import QuizIcon from "@mui/icons-material/QuizOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import GradingIcon from "@mui/icons-material/GradingOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlined";
import SendIcon from "@mui/icons-material/SendOutlined";
import type { NavItem } from "../../components/AppShell";

export const teacherNavItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/teacher",
    icon: <DashboardIcon fontSize="small" />,
  },
  {
    label: "My Students",
    to: "/teacher/students",
    icon: <GroupIcon fontSize="small" />,
  },
  {
    label: "Mark Attendance",
    to: "/teacher/attendance",
    icon: <FactCheckIcon fontSize="small" />,
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
    to: "/admin/parents/message",
    icon: <SendIcon fontSize="small" />,
  },
];
