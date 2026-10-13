import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import LiveTvIcon from "@mui/icons-material/LiveTvOutlined";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import QuizIcon from "@mui/icons-material/QuizOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import BarChartIcon from "@mui/icons-material/BarChartOutlined";
import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import EditNoteIcon from "@mui/icons-material/EditNoteOutlined";
import type { NavItem } from "../../components/AppShell";

export const studentNavItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/student",
    icon: <DashboardIcon fontSize="small" />,
  },
  {
    label: "Notices",
    to: "/student/notices",
    icon: <CampaignIcon fontSize="small" />,
  },
  {
    label: "Homework",
    to: "/student/homework",
    icon: <EditNoteIcon fontSize="small" />,
  },
  {
    label: "Live Classes",
    to: "/student/live-classes",
    icon: <LiveTvIcon fontSize="small" />,
  },
  {
    label: "Video Lectures",
    to: "/student/videos",
    icon: <VideoLibraryIcon fontSize="small" />,
  },
  {
    label: "Books Library",
    to: "/student/books",
    icon: <MenuBookIcon fontSize="small" />,
  },
  {
    label: "Quizzes",
    to: "/student/quizzes",
    icon: <QuizIcon fontSize="small" />,
  },
  {
    label: "Assignments",
    to: "/student/assignments",
    icon: <AssignmentIcon fontSize="small" />,
  },
  {
    label: "My Attendance",
    to: "/student/attendance",
    icon: <FactCheckIcon fontSize="small" />,
  },
  {
    label: "My Progress",
    to: "/student/progress",
    icon: <BarChartIcon fontSize="small" />,
  },
];
