import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import QuizIcon from "@mui/icons-material/QuizOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import LiveTvIcon from "@mui/icons-material/LiveTvOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import AssessmentIcon from "@mui/icons-material/AssessmentOutlined";
import type { NavItem } from "../../components/AppShell";

export const adminNavItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/admin",
    icon: <DashboardIcon fontSize="small" />,
  },

  {
    label: "Students",
    to: "/admin/students",
    icon: <SchoolIcon fontSize="small" />,
    children: [
      { label: "Student Dashboard", to: "/admin/students" },
      { label: "Active Students", to: "/admin/students" },
      { label: "Family List", to: "/admin/families" },
      { label: "Admission Register", to: "/admin/students/register" },
      { label: "Old Students", to: "/admin/students/withdrawals" },
      { label: "Student Reports", to: "/admin/students/reports" },
      { label: "Student Documents", to: "/admin/students/documents" },
      { label: "Student Cards", to: "/admin/students/cards" },
    ],
  },

  {
    label: "Teachers",
    to: "/admin/teachers",
    icon: <BadgeIcon fontSize="small" />,
    children: [
      { label: "All Teachers", to: "/admin/teachers" },
    ],
  },

  {
    label: "Parents",
    to: "/admin/parents",
    icon: <PeopleIcon fontSize="small" />,
    children: [
      { label: "All Parents", to: "/admin/parents" },
      { label: "Send Message", to: "/admin/parents/message" },
    ],
  },

  {
    label: "Classes",
    to: "/admin/classes",
    icon: <ClassIcon fontSize="small" />,
    children: [
      { label: "All Classes (1-10)", to: "/admin/classes" },
      { label: "Subjects", to: "/admin/curriculum/subjects" },
      { label: "Timetable", to: "/admin/schedule" },
    ],
  },

  {
    label: "Attendance",
    to: "/admin/attendance",
    icon: <FactCheckIcon fontSize="small" />,
    children: [
      { label: "Student Attendance", to: "/admin/attendance" },
      { label: "Teacher Attendance", to: "/admin/attendance/teachers" },
      { label: "Attendance Reports", to: "/admin/attendance/reports" },
      { label: "Holiday Calendar", to: "/admin/attendance/settings" },
    ],
  },

  {
    label: "Live Classes",
    to: "/admin/lms/live-classes",
    icon: <LiveTvIcon fontSize="small" />,
    children: [
      { label: "All Live Classes", to: "/admin/lms/live-classes" },
    ],
  },

  {
    label: "Video Lectures",
    to: "/admin/lms/videos",
    icon: <VideoLibraryIcon fontSize="small" />,
    children: [
      { label: "All Videos", to: "/admin/lms/videos" },
    ],
  },

  {
    label: "Books Library",
    to: "/admin/lms/books",
    icon: <MenuBookIcon fontSize="small" />,
    children: [
      { label: "All Books", to: "/admin/lms/books" },
    ],
  },

  {
    label: "Quizzes",
    to: "/admin/lms/quizzes",
    icon: <QuizIcon fontSize="small" />,
    children: [
      { label: "All Quizzes", to: "/admin/lms/quizzes" },
      { label: "Results", to: "/admin/lms/reports" },
    ],
  },

  {
    label: "Assignments",
    to: "/admin/lms/assignments",
    icon: <AssignmentIcon fontSize="small" />,
    children: [
      { label: "All Assignments", to: "/admin/lms/assignments" },
    ],
  },

  {
    label: "Fee",
    to: "/admin/fees",
    icon: <PaymentsIcon fontSize="small" />,
    children: [
      { label: "Fee Plans", to: "/admin/fees" },
      { label: "Invoices", to: "/admin/fees/invoices" },
      { label: "Payments", to: "/admin/fees/payments" },
      { label: "Pending Fees", to: "/admin/fees/payments/pending" },
      { label: "Fee Reports", to: "/admin/fees/reports" },
    ],
  },

  {
    label: "Notices",
    to: "/admin/communication/notices",
    icon: <CampaignIcon fontSize="small" />,
    children: [
      { label: "Notice Board", to: "/admin/communication/notices" },
      { label: "Send Message", to: "/admin/communication/messages" },
      { label: "Events", to: "/admin/communication/events" },
    ],
  },

  {
    label: "Reports",
    to: "/admin/students/reports",
    icon: <AssessmentIcon fontSize="small" />,
    children: [
      { label: "Student Reports", to: "/admin/students/reports" },
      { label: "Attendance Reports", to: "/admin/attendance/reports" },
      { label: "Fee Reports", to: "/admin/fees/reports" },
      { label: "LMS Reports", to: "/admin/lms/reports" },
    ],
  },

  {
    label: "Settings",
    to: "/admin/settings",
    icon: <SettingsIcon fontSize="small" />,
    children: [
      { label: "All Settings", to: "/admin/settings" },
      { label: "Academic Years", to: "/admin/academic-years" },
      { label: "Student Promotion", to: "/admin/settings/promotion" },
      { label: "Automation", to: "/admin/settings/automation" },
    ],
  },
];
