import { teacherNavItems } from "../teacherNav";
import { BorrowerLibraryView, libraryTeacherNav, withLibraryNav } from "../../libraryShared";

const navItems = withLibraryNav(teacherNavItems, libraryTeacherNav);

export function TeacherLibraryPage() {
  return <BorrowerLibraryView navItems={navItems} />;
}
