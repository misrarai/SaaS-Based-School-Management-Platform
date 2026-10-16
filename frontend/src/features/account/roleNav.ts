import type { Role } from "../../api/auth";
import type { NavItem } from "../../components/AppShell";
import { adminNavItems } from "../admin/adminNav";
import { teacherNavItems } from "../teacher/teacherNav";
import { studentNavItems } from "../student/studentNav";
import { parentNavItems } from "../parent/parentNav";

export function navItemsForRole(role: Role | undefined): NavItem[] {
  switch (role) {
    case "admin":
      return adminNavItems;
    case "teacher":
      return teacherNavItems;
    case "student":
      return studentNavItems;
    case "parent":
      return parentNavItems;
    default:
      return [];
  }
}
