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
import EventIcon from "@mui/icons-material/EventOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import GradingIcon from "@mui/icons-material/GradingOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import EmojiEventsIcon from "@mui/icons-material/EmojiEventsOutlined";
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
    label: "Quiz Results",
    to: "/student/quiz-history",
    icon: <GradingIcon fontSize="small" />,
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
  {
    label: "Exam Schedule",
    to: "/student/exams",
    icon: <EventIcon fontSize="small" />,
  },
  {
    label: "My Results",
    to: "/student/marks",
    icon: <EmojiEventsIcon fontSize="small" />,
  },
  {
    label: "My Fees",
    to: "/student/fees",
    icon: <PaymentsIcon fontSize="small" />,
  },
  {
    label: "My Profile",
    to: "/student/profile",
    icon: <PersonIcon fontSize="small" />,
  },
];
