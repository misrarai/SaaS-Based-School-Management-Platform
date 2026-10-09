import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import type { NavItem } from "../components/AppShell";
import { adminNavItems } from "./admin/adminNav";
import { teacherNavItems } from "./teacher/teacherNav";
import { studentNavItems } from "./student/studentNav";
import { parentNavItems } from "./parent/parentNav";
import { frontOfficeAdminNav } from "./frontOfficeNav";

export const communicationAdminNav: NavItem[] = [
  {
    label: "Communication",
    to: "/admin/communication/notices",
    icon: <CampaignIcon fontSize="small" />,
    children: [
      { label: "Notice Board", to: "/admin/communication/notices" },
      { label: "Daily Diary", to: "/admin/communication/diary" },
      { label: "Messages", to: "/admin/communication/messages" },
      { label: "Events Calendar", to: "/admin/communication/events" },
      { label: "To-do List", to: "/admin/communication/todos" },
      { label: "Send SMS", to: "/admin/communication/sms" },
    ],
  },
];

function portalItems(prefix: string, diaryLabel: string): NavItem[] {
  return [
    { label: "Notice Board", to: `${prefix}/communication/notices`, icon: <CampaignIcon fontSize="small" /> },
    { label: diaryLabel, to: `${prefix}/communication/diary`, icon: <MenuBookIcon fontSize="small" /> },
    { label: "Messages", to: `${prefix}/communication/messages`, icon: <ForumIcon fontSize="small" /> },
    { label: "Events Calendar", to: `${prefix}/communication/events`, icon: <CalendarMonthIcon fontSize="small" /> },
  ];
}

export const communicationTeacherNav: NavItem[] = portalItems("/teacher", "Daily Diary");
export const communicationStudentNav: NavItem[] = portalItems("/student", "Daily Diary");
export const communicationParentNav: NavItem[] = portalItems("/parent", "Daily Diary");

function merge(base: NavItem[], extra: NavItem[]): NavItem[] {
  const labels = new Set(base.map((i) => i.label));
  const tos = new Set(base.map((i) => i.to));
  return [...base, ...extra.filter((i) => !labels.has(i.label) && !tos.has(i.to))];
}

/** Sidebar used by the pages of these two modules until the main nav files include the groups. */
export const adminModuleNav: NavItem[] = merge(adminNavItems, frontOfficeAdminNav);
export const teacherModuleNav: NavItem[] = merge(teacherNavItems, communicationTeacherNav);
export const studentModuleNav: NavItem[] = merge(studentNavItems, communicationStudentNav);
export const parentModuleNav: NavItem[] = merge(parentNavItems, communicationParentNav);
