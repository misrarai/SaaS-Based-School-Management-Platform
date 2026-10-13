import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import LiveTvIcon from "@mui/icons-material/LiveTvOutlined";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import QuizIcon from "@mui/icons-material/QuizOutlined";
import MessageIcon from "@mui/icons-material/MessageOutlined";
import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import type { NavItem } from "../../components/AppShell";

export const parentNavItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/parent",
    icon: <DashboardIcon fontSize="small" />,
  },
  {
    label: "Notices",
    to: "/parent/notices",
    icon: <CampaignIcon fontSize="small" />,
  },
  {
    label: "Attendance",
    to: "/parent/attendance",
    icon: <FactCheckIcon fontSize="small" />,
  },
  {
    label: "Live Classes",
    to: "/parent/live-classes",
    icon: <LiveTvIcon fontSize="small" />,
  },
  {
    label: "Video Lectures",
    to: "/parent/videos",
    icon: <VideoLibraryIcon fontSize="small" />,
  },
  {
    label: "Books",
    to: "/parent/books",
    icon: <MenuBookIcon fontSize="small" />,
  },
  {
    label: "Quizzes & Marks",
    to: "/parent/gradebook",
    icon: <QuizIcon fontSize="small" />,
  },
  {
    label: "Assignments",
    to: "/parent/assignments",
    icon: <AssignmentIcon fontSize="small" />,
  },
  {
    label: "Messages",
    to: "/parent/messages",
    icon: <MessageIcon fontSize="small" />,
  },
  {
    label: "Fee",
    to: "/parent/fees",
    icon: <PaymentsIcon fontSize="small" />,
  },
];
