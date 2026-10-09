/**
 * Library module wiring. Spread these into routes/index.tsx and the role nav files:
 *   libraryAdminRoutes.map((r) => <Route key={r.path} {...r} />)
 *   adminNavItems: [..., libraryAdminNav]; studentNavItems: [..., libraryStudentNav]; etc.
 * Each page already appends its own nav entry (deduplicated) so the module works before nav wiring.
 */
import type { ReactNode } from "react";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import type { Role } from "../api/auth";
import { LibraryCataloguePage } from "./admin/library/CataloguePage";
import { LibraryCirculationPage } from "./admin/library/CirculationPage";
import { LibraryReservationsPage } from "./admin/library/ReservationsPage";
import { LibraryOverdueFinesPage } from "./admin/library/OverdueFinesPage";
import { LibrarySettingsPage } from "./admin/library/LibrarySettingsPage";
import { StudentLibraryPage } from "./student/library/StudentLibraryPage";
import { TeacherLibraryPage } from "./teacher/library/TeacherLibraryPage";
import { ParentLibraryPage } from "./parent/library/ParentLibraryPage";

export { libraryAdminNav, libraryParentNav, libraryStudentNav, libraryTeacherNav } from "./libraryShared";

export interface LibraryRoute {
  path: string;
  element: ReactNode;
}

const guard = (role: Role, page: ReactNode) => <ProtectedRoute allowedRoles={[role]}>{page}</ProtectedRoute>;

export const libraryAdminRoutes: LibraryRoute[] = [
  { path: "/admin/library", element: guard("admin", <LibraryCataloguePage />) },
  { path: "/admin/library/circulation", element: guard("admin", <LibraryCirculationPage />) },
  { path: "/admin/library/reservations", element: guard("admin", <LibraryReservationsPage />) },
  { path: "/admin/library/fines", element: guard("admin", <LibraryOverdueFinesPage />) },
  { path: "/admin/library/settings", element: guard("admin", <LibrarySettingsPage />) },
];

export const libraryStudentRoutes: LibraryRoute[] = [
  { path: "/student/library", element: guard("student", <StudentLibraryPage />) },
];

export const libraryTeacherRoutes: LibraryRoute[] = [
  { path: "/teacher/library", element: guard("teacher", <TeacherLibraryPage />) },
];

export const libraryParentRoutes: LibraryRoute[] = [
  { path: "/parent/library", element: guard("parent", <ParentLibraryPage />) },
];
