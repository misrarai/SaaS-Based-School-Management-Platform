import DirectionsBusIcon from "@mui/icons-material/DirectionsBusOutlined";
import HotelIcon from "@mui/icons-material/HotelOutlined";
import type { NavItem } from "../components/AppShell";
import { adminNavItems } from "./admin/adminNav";
import { parentNavItems } from "./parent/parentNav";
import { studentNavItems } from "./student/studentNav";

export const transportAdminNav: NavItem = {
  label: "Transport",
  to: "/admin/transport/vehicles",
  icon: <DirectionsBusIcon fontSize="small" />,
  children: [
    { label: "Vehicles", to: "/admin/transport/vehicles" },
    { label: "Drivers", to: "/admin/transport/drivers" },
    { label: "Routes & Stops", to: "/admin/transport/routes" },
    { label: "Student Allocation", to: "/admin/transport/allocations" },
    { label: "Transport Fees", to: "/admin/transport/fees" },
    { label: "Transport Reports", to: "/admin/transport/reports" },
  ],
};

export const hostelAdminNav: NavItem = {
  label: "Hostel",
  to: "/admin/hostel",
  icon: <HotelIcon fontSize="small" />,
  children: [
    { label: "Hostels & Rooms", to: "/admin/hostel" },
    { label: "Allocations", to: "/admin/hostel/allocations" },
    { label: "Mess Menu", to: "/admin/hostel/mess-menu" },
    { label: "Outpasses", to: "/admin/hostel/outpasses" },
    { label: "Occupancy", to: "/admin/hostel/occupancy" },
  ],
};

export const transportParentNav: NavItem = {
  label: "Transport",
  to: "/parent/transport",
  icon: <DirectionsBusIcon fontSize="small" />,
};
export const hostelParentNav: NavItem = { label: "Hostel", to: "/parent/hostel", icon: <HotelIcon fontSize="small" /> };
export const transportStudentNav: NavItem = {
  label: "Transport",
  to: "/student/transport",
  icon: <DirectionsBusIcon fontSize="small" />,
};
export const hostelStudentNav: NavItem = { label: "Hostel", to: "/student/hostel", icon: <HotelIcon fontSize="small" /> };

/** Appends module nav groups to a role's base nav, skipping any already present (so the sidebar
 * stays correct whether or not the integrator has merged these groups into the role nav files). */
function merge(base: NavItem[], extra: NavItem[]): NavItem[] {
  const seen = new Set(base.map((i) => i.to));
  return [...base, ...extra.filter((i) => !seen.has(i.to))];
}

export const adminNavWithTransportHostel = () => merge(adminNavItems, [transportAdminNav, hostelAdminNav]);
export const parentNavWithTransportHostel = () => merge(parentNavItems, [transportParentNav, hostelParentNav]);
export const studentNavWithTransportHostel = () => merge(studentNavItems, [transportStudentNav, hostelStudentNav]);
