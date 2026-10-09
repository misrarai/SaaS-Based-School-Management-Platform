import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { useAuth } from "../auth/AuthContext";
import { LoginPage } from "../pages/LoginPage";
import { OnboardingPage } from "../pages/OnboardingPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { AdminDashboard } from "../features/admin/AdminDashboard";
import { ClassesPage } from "../features/admin/ClassesPage";
import { TeachersPage } from "../features/admin/TeachersPage";
import { StudentsPage } from "../features/admin/StudentsPage";
import { FamiliesPage } from "../features/admin/FamiliesPage";
import { StaffPage } from "../features/admin/StaffPage";
import { RegisterStudentPage } from "../features/admin/students/RegisterStudentPage";
import { ImportStudentsPage } from "../features/admin/students/ImportStudentsPage";
import { WithdrawalRegisterPage } from "../features/admin/students/WithdrawalRegisterPage";
import { ExtraCoachingPage } from "../features/admin/students/ExtraCoachingPage";
import { StudentReportsPage } from "../features/admin/students/StudentReportsPage";
import { StudentCertificatesPage } from "../features/admin/students/StudentCertificatesPage";
import { StudentCardsPage } from "../features/admin/students/StudentCardsPage";
import { TimetablePage as AdminTimetablePage } from "../features/admin/schedule/TimetablePage";
import { AttendanceAnalyticsPage } from "../features/admin/attendance/AttendanceAnalyticsPage";
import { TeacherAttendancePage } from "../features/admin/attendance/TeacherAttendancePage";
import { StaffAttendancePage } from "../features/admin/attendance/StaffAttendancePage";
import { FeePlansPage } from "../features/admin/fees/FeePlansPage";
import { InvoicesPage } from "../features/admin/fees/InvoicesPage";
import { StudentSubscriptionsPage } from "../features/admin/fees/StudentSubscriptionsPage";
import { PaymentsPage } from "../features/admin/fees/PaymentsPage";
import { PendingPaymentsPage } from "../features/admin/fees/PendingPaymentsPage";
import { PaymentVerificationPage } from "../features/admin/fees/PaymentVerificationPage";
import { ReceiptsPage } from "../features/admin/fees/ReceiptsPage";
import { ReportsPage as FeeReportsPage } from "../features/admin/fees/ReportsPage";
import { PayoutRatesPage } from "../features/admin/payouts/PayoutRatesPage";
import { PayoutsPage } from "../features/admin/payouts/PayoutsPage";
import { NotificationsPage } from "../features/admin/notifications/NotificationsPage";
import { AcademicYearsPage } from "../features/admin/academics/AcademicYearsPage";
import { CoursesPage } from "../features/admin/academics/CoursesPage";
import { ChartOfAccountsPage } from "../features/admin/accounting/ChartOfAccountsPage";
import { IncomeExpensePage } from "../features/admin/accounting/IncomeExpensePage";
import { VouchersPage } from "../features/admin/accounting/VouchersPage";
import { EnquiriesPage } from "../features/admin/front-office/EnquiriesPage";
import { VisitorsPage } from "../features/admin/front-office/VisitorsPage";
import { ComplaintsPage } from "../features/admin/front-office/ComplaintsPage";
import { PostalPage } from "../features/admin/front-office/PostalPage";
import { GatePassesPage } from "../features/admin/front-office/GatePassesPage";
import { CallLogPage } from "../features/admin/front-office/CallLogPage";
import { EmployeesPage } from "../features/admin/payroll/EmployeesPage";
import { DepartmentsPage } from "../features/admin/payroll/DepartmentsPage";
import { SalaryStructuresPage } from "../features/admin/payroll/SalaryStructuresPage";
import { LeaveRequestsPage } from "../features/admin/payroll/LeaveRequestsPage";
import { LeaveTypesPage } from "../features/admin/payroll/LeaveTypesPage";
import { VehiclesPage } from "../features/admin/transport/VehiclesPage";
import { DriversPage } from "../features/admin/transport/DriversPage";
import { RoutesPage as TransportRoutesPage } from "../features/admin/transport/RoutesPage";
import { TransportAllocationsPage } from "../features/admin/transport/TransportAllocationsPage";
import { TransportFeesPage } from "../features/admin/transport/TransportFeesPage";
import { TransportReportsPage } from "../features/admin/transport/TransportReportsPage";
import { HostelsPage } from "../features/admin/hostel/HostelsPage";
import { HostelAllocationsPage } from "../features/admin/hostel/HostelAllocationsPage";
import {
  examsAdminRoutes,
  examsParentRoutes,
  examsStudentRoutes,
  examsTeacherRoutes,
} from "../features/examsModule";
import {
  libraryAdminRoutes,
  libraryParentRoutes,
  libraryStudentRoutes,
  libraryTeacherRoutes,
} from "../features/libraryModule";
import { TeacherDashboard } from "../features/teacher/TeacherDashboard";
import { MyClassesPage } from "../features/teacher/classes/MyClassesPage";
import { MyStudentsPage } from "../features/teacher/students/MyStudentsPage";
import { TimetablePage as TeacherTimetablePage } from "../features/teacher/TimetablePage";
import { MarkAttendancePage } from "../features/teacher/attendance/MarkAttendancePage";
import { MyAttendancePage } from "../features/teacher/attendance/MyAttendancePage";
import { ResourceLibraryPage as TeacherResourceLibraryPage } from "../features/teacher/resources/ResourceLibraryPage";
import { AssignmentsPage as TeacherAssignmentsPage } from "../features/teacher/assignments/AssignmentsPage";
import { SubmissionsReviewPage } from "../features/teacher/assignments/SubmissionsReviewPage";
import { QuizzesPage as TeacherQuizzesPage } from "../features/teacher/quizzes/QuizzesPage";
import { QuizBuilderPage } from "../features/teacher/quizzes/QuizBuilderPage";
import { QuizResultsPage } from "../features/teacher/quizzes/QuizResultsPage";
import { GradeAttemptPage } from "../features/teacher/quizzes/GradeAttemptPage";
import { GradebookPage as TeacherGradebookPage } from "../features/teacher/gradebook/GradebookPage";
import { LiveClassesPage } from "../features/teacher/live/LiveClassesPage";
import { MyPayoutsPage } from "../features/teacher/payouts/MyPayoutsPage";
import { StudentDashboard } from "../features/student/StudentDashboard";
import { TimetablePage as StudentTimetablePage } from "../features/student/TimetablePage";
import { ResourceCenterPage } from "../features/student/resources/ResourceCenterPage";
import { AssignmentsPage as StudentAssignmentsPage } from "../features/student/assignments/AssignmentsPage";
import { QuizListPage as StudentQuizListPage } from "../features/student/quizzes/QuizListPage";
import { TakeQuizPage } from "../features/student/quizzes/TakeQuizPage";
import { ParentDashboard } from "../features/parent/ParentDashboard";
import { TimetablePage as ParentTimetablePage } from "../features/parent/TimetablePage";
import { AttendanceSummaryPage as ParentAttendanceSummaryPage } from "../features/parent/attendance/AttendanceSummaryPage";
import { ParentFeesPage } from "../features/parent/fees/ParentFeesPage";
import { GradebookPage as ParentGradebookPage } from "../features/parent/assignments/GradebookPage";

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading…</div>;
  if (!user) return <Navigate to="/register" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/classes"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/academic-years"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AcademicYearsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/courses"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <CoursesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/teachers"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <TeachersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StudentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/register"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <RegisterStudentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/import"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ImportStudentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/withdrawals"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <WithdrawalRegisterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/extra-coaching"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ExtraCoachingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StudentReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/certificates"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StudentCertificatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/cards"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StudentCardsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/families"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <FamiliesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StaffPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/schedule"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminTimetablePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/attendance"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AttendanceAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/attendance/teachers"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <TeacherAttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/attendance/staff"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StaffAttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fees"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <FeePlansPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fees/invoices"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <InvoicesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fees/subscriptions"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StudentSubscriptionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fees/payments/all"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PaymentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fees/payments/pending"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PendingPaymentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fees/payments"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PaymentVerificationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fees/receipts"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReceiptsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fees/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <FeeReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payouts"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PayoutsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payouts/rates"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PayoutRatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/accounting/accounts"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ChartOfAccountsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/accounting/income-expenses"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <IncomeExpensePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/accounting/vouchers"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <VouchersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office/enquiries"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <EnquiriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office/visitors"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <VisitorsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office/complaints"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ComplaintsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office/postal"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PostalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office/gate-passes"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <GatePassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office/calls"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <CallLogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payroll/employees"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <EmployeesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payroll/departments"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DepartmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payroll/salary-structures"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <SalaryStructuresPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payroll/leaves"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <LeaveRequestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payroll/leave-types"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <LeaveTypesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transport/vehicles"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <VehiclesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transport/drivers"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DriversPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transport/routes"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <TransportRoutesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transport/allocations"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <TransportAllocationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transport/fees"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <TransportFeesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transport/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <TransportReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/hostel"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <HostelsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/hostel/allocations"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <HostelAllocationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/classes"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <MyClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/students"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <MyStudentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/timetable"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherTimetablePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/attendance"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <MarkAttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/my-attendance"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <MyAttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/resources"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherResourceLibraryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/assignments"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherAssignmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/assignments/:assignmentId/submissions"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <SubmissionsReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/quizzes"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherQuizzesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/quizzes/new"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <QuizBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/quizzes/:quizId/results"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <QuizResultsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/quizzes/attempts/:attemptId/grade"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <GradeAttemptPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/gradebook"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherGradebookPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/live-classes"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <LiveClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/payouts"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <MyPayoutsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/timetable"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentTimetablePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/resources"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <ResourceCenterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/assignments"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentAssignmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/quizzes"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentQuizListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/quizzes/:quizId/take"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <TakeQuizPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/timetable"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentTimetablePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/attendance"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentAttendanceSummaryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/fees"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentFeesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/gradebook"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentGradebookPage />
          </ProtectedRoute>
        }
      />
      {examsAdminRoutes.map((route) => <Route key={route.path} {...route} />)}
      {examsTeacherRoutes.map((route) => <Route key={route.path} {...route} />)}
      {examsStudentRoutes.map((route) => <Route key={route.path} {...route} />)}
      {examsParentRoutes.map((route) => <Route key={route.path} {...route} />)}
      {libraryAdminRoutes.map((route) => <Route key={route.path} {...route} />)}
      {libraryTeacherRoutes.map((route) => <Route key={route.path} {...route} />)}
      {libraryStudentRoutes.map((route) => <Route key={route.path} {...route} />)}
      {libraryParentRoutes.map((route) => <Route key={route.path} {...route} />)}
      <Route path="/" element={<HomeRedirect />} />
    </Routes>
  );
}
