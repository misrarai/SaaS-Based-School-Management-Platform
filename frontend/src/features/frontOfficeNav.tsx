import RoomServiceIcon from "@mui/icons-material/RoomServiceOutlined";
import type { NavItem } from "../components/AppShell";

export const frontOfficeAdminNav: NavItem[] = [
  {
    label: "Front Office",
    to: "/admin/front-office",
    icon: <RoomServiceIcon fontSize="small" />,
    children: [
      { label: "Dashboard", to: "/admin/front-office" },
      { label: "Admission Enquiries", to: "/admin/front-office/enquiries" },
      { label: "Visitor Book", to: "/admin/front-office/visitors" },
      { label: "Complaints", to: "/admin/front-office/complaints" },
      { label: "Postal Register", to: "/admin/front-office/postal" },
      { label: "Gate Passes", to: "/admin/front-office/gate-passes" },
      { label: "Phone Call Log", to: "/admin/front-office/calls" },
      { label: "Appointments", to: "/admin/front-office/appointments" },
      { label: "Lost & Found", to: "/admin/front-office/lost-found" },
      { label: "Reports", to: "/admin/front-office/reports" },
    ],
  },
];
