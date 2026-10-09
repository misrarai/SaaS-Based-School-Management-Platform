import { studentNavItems } from "../studentNav";
import { BorrowerLibraryView, libraryStudentNav, withLibraryNav } from "../../libraryShared";

const navItems = withLibraryNav(studentNavItems, libraryStudentNav);

export function StudentLibraryPage() {
  return <BorrowerLibraryView navItems={navItems} />;
}
