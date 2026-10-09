/**
 * Examinations module wiring. Spread these into routes/index.tsx and the role nav files:
 *   examsAdminRoutes.map((r) => <Route key={r.path} {...r} />)   (same for teacher/student/parent)
 *   adminNavItems: [..., examsAdminNav]; teacherNavItems: [..., examsTeacherNav];
 *   studentNavItems: [..., examsStudentNav]; parentNavItems: [..., examsParentNav]
 * Route elements are already wrapped in ProtectedRoute for the right role.
 */
import type { ReactNode } from "react";
import HistoryEduIcon from "@mui/icons-material/HistoryEduOutlined";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import type { Role } from "../api/auth";
import type { NavItem } from "../components/AppShell";
import { ExamsPage } from "./admin/exams/ExamsPage";
import { GradingSchemesPage } from "./admin/exams/GradingSchemesPage";
import { DatesheetPage } from "./admin/exams/DatesheetPage";
import { MarksEntryPage } from "./admin/exams/MarksEntryPage";
import { ResultsPage } from "./admin/exams/ResultsPage";
import { TeacherMarksEntryPage } from "./teacher/exams/TeacherMarksEntryPage";
import { MyResultsPage } from "./student/exams/MyResultsPage";
import { ParentResultsPage } from "./parent/exams/ParentResultsPage";

export interface ExamsRoute {
  path: string;
  element: ReactNode;
}

const guard = (role: Role, page: ReactNode) => <ProtectedRoute allowedRoles={[role]}>{page}</ProtectedRoute>;

export const examsAdminRoutes: ExamsRoute[] = [
  { path: "/admin/exams", element: guard("admin", <ExamsPage />) },
  { path: "/admin/exams/grading-schemes", element: guard("admin", <GradingSchemesPage />) },
  { path: "/admin/exams/marks", element: guard("admin", <MarksEntryPage />) },
  { path: "/admin/exams/results", element: guard("admin", <ResultsPage />) },
  { path: "/admin/exams/:examId/datesheet", element: guard("admin", <DatesheetPage />) },
];

export const examsTeacherRoutes: ExamsRoute[] = [
  { path: "/teacher/exam-marks", element: guard("teacher", <TeacherMarksEntryPage />) },
];

export const examsStudentRoutes: ExamsRoute[] = [
  { path: "/student/results", element: guard("student", <MyResultsPage />) },
];

export const examsParentRoutes: ExamsRoute[] = [
  { path: "/parent/results", element: guard("parent", <ParentResultsPage />) },
];

export const examsAdminNav: NavItem = {
  label: "Examinations",
  to: "/admin/exams",
  icon: <HistoryEduIcon fontSize="small" />,
  children: [
    { label: "Exams & Datesheets", to: "/admin/exams" },
    { label: "Grading Schemes", to: "/admin/exams/grading-schemes" },
    { label: "Marks Entry", to: "/admin/exams/marks" },
    { label: "Results / Tabulation", to: "/admin/exams/results" },
  ],
};

export const examsTeacherNav: NavItem = {
  label: "Exam Marks",
  to: "/teacher/exam-marks",
  icon: <HistoryEduIcon fontSize="small" />,
};

export const examsStudentNav: NavItem = {
  label: "My Results",
  to: "/student/results",
  icon: <HistoryEduIcon fontSize="small" />,
};

export const examsParentNav: NavItem = {
  label: "Exam Results",
  to: "/parent/results",
  icon: <HistoryEduIcon fontSize="small" />,
};
