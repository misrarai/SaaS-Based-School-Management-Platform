import { Navigate, Route, Routes } from "react-router-dom";
import { NotFoundPage } from "../features/account/NotFoundPage";
import { ProfilePage } from "../features/account/ProfilePage";
import { ChangePasswordPage } from "../features/account/ChangePasswordPage";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { useAuth } from "../auth/AuthContext";
import { LoginPage } from "../pages/LoginPage";
import { OnboardingPage } from "../pages/OnboardingPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { AdminDashboard } from "../features/admin/AdminDashboard";
import { ClassesPage } from "../features/admin/ClassesPage";
import { SectionsPage } from "../features/admin/classes/SectionsPage";
import { SubjectsPage } from "../features/admin/classes/SubjectsPage";
import { TeachersPage } from "../features/admin/TeachersPage";
import { StudentsPage } from "../features/admin/StudentsPage";
import { FamiliesPage } from "../features/admin/FamiliesPage";
import { StaffPage } from "../features/admin/StaffPage";
import { RegisterStudentPage } from "../features/admin/students/RegisterStudentPage";
import { ImportStudentsPage } from "../features/admin/students/ImportStudentsPage";
import { WithdrawalRegisterPage } from "../features/admin/students/WithdrawalRegisterPage";
import { StudentDocumentsPage } from "../features/admin/students/StudentDocumentsPage";
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
import { CollectFeePage } from "../features/admin/fees/CollectFeePage";
import { CollectFamilyFeePage } from "../features/admin/fees/CollectFamilyFeePage";
import { ViewChallanPage } from "../features/admin/fees/ViewChallanPage";
import { FeeHeadsPage } from "../features/admin/fees/FeeHeadsPage";
import { SlipsPage } from "../features/admin/fees/SlipsPage";
import { FeeCollectionReportsPage } from "../features/admin/fees/FeeCollectionReportsPage";
import { FeeAnalyticsPage } from "../features/admin/fees/FeeAnalyticsPage";
import { CreateChallanPage } from "../features/admin/fees/CreateChallanPage";
import { SendSMSPage as FeeSendSMSPage } from "../features/admin/fees/SendSMSPage";
import { FeeSettingPage } from "../features/admin/fees/FeeSettingPage";
import { SecurityFeePage } from "../features/admin/fees/SecurityFeePage";
import { PayoutRatesPage } from "../features/admin/payouts/PayoutRatesPage";
import { PayoutsPage } from "../features/admin/payouts/PayoutsPage";
import { NotificationsPage } from "../features/admin/notifications/NotificationsPage";
import { AcademicYearsPage } from "../features/admin/academics/AcademicYearsPage";
import { CoursesPage } from "../features/admin/academics/CoursesPage";
import { ChartOfAccountsPage } from "../features/admin/accounting/ChartOfAccountsPage";
import { IncomeExpensePage } from "../features/admin/accounting/IncomeExpensePage";
import { VouchersPage } from "../features/admin/accounting/VouchersPage";
import { FrontDeskDashboardPage } from "../features/admin/front-office/FrontDeskDashboardPage";
import { ComingSoonPage } from "../features/admin/ComingSoonPage";
import { AppointmentsPage } from "../features/admin/front-office/AppointmentsPage";
import { LostFoundPage } from "../features/admin/front-office/LostFoundPage";
import { FrontDeskReportsPage } from "../features/admin/front-office/FrontDeskReportsPage";
import { AdminLiveClassesPage } from "../features/admin/lms/LiveClassesPage";
import { VideoLecturesPage } from "../features/admin/lms/VideoLecturesPage";
import { AdminAssignmentsPage } from "../features/admin/lms/AssignmentsPage";
import { AdminQuizzesPage } from "../features/admin/lms/QuizzesPage";
import { LmsReportsPage } from "../features/admin/lms/ReportsPage";
import { LibraryDashboardPage } from "../features/admin/library/LibraryDashboardPage";
import { BookItemsPage } from "../features/admin/library/BookItemsPage";
import { QuickScanPage } from "../features/admin/library/QuickScanPage";
import { StockAuditPage } from "../features/admin/library/StockAuditPage";
import { LibraryReportsPage } from "../features/admin/library/LibraryReportsPage";
import { ExamDashboardPage } from "../features/admin/exams/ExamDashboardPage";
import { AdmitCardsPage } from "../features/admin/exams/AdmitCardsPage";
import { PrintReportsPage } from "../features/admin/exams/PrintReportsPage";
import { NoticesPage } from "../features/admin/communication/NoticesPage";
import { DiaryPage } from "../features/admin/communication/DiaryPage";
import { MessagesPage } from "../features/admin/communication/MessagesPage";
import { EventsPage } from "../features/admin/communication/EventsPage";
import { TodosPage } from "../features/admin/communication/TodosPage";
import { SendSmsPage } from "../features/admin/communication/SendSmsPage";
import { InventoryDashboardPage } from "../features/admin/inventory/InventoryDashboardPage";
import { CatalogPage } from "../features/admin/inventory/CatalogPage";
import { StockPage } from "../features/admin/inventory/StockPage";
import { AssetsPage } from "../features/admin/inventory/AssetsPage";
import { InventoryReportsPage } from "../features/admin/inventory/ReportsPage";
import { RequisitionsPage } from "../features/admin/inventory/RequisitionsPage";
import { PayRunsPage } from "../features/admin/payroll/PayRunsPage";
import { AdvancesPage } from "../features/admin/payroll/AdvancesPage";
import { SaleTerminalPage } from "../features/admin/pos/SaleTerminalPage";
import { PosDashboardPage } from "../features/admin/pos/PosDashboardPage";
import { PosReportsPage } from "../features/admin/pos/PosReportsPage";
import { AutomationPage } from "../features/admin/settings/AutomationPage";
import { HalqasPage } from "../features/admin/hifz/HalqasPage";
import { EnrolmentsPage } from "../features/admin/hifz/EnrolmentsPage";
import { PromotionPage } from "../features/admin/settings/PromotionPage";
import { DonorsPage } from "../features/admin/hifz/DonorsPage";
import { SponsorshipsPage } from "../features/admin/hifz/SponsorshipsPage";
import { DownloadCenterPage } from "../features/admin/downloads/DownloadCenterPage";
import { RecruitmentPage } from "../features/admin/hr/RecruitmentPage";
import { HolidayCalendarPage } from "../features/admin/attendance/HolidayCalendarPage";
import { PeopleDirectoryPage } from "../features/admin/people/PeopleDirectoryPage";
import { CurriculumPage } from "../features/admin/curriculum/CurriculumPage";
import { AttendanceSettingsPage } from "../features/admin/attendance/AttendanceSettingsPage";
import { AttendanceReportsPage } from "../features/admin/attendance/AttendanceReportsPage";
import { DatesheetManagerPage } from "../features/admin/datesheet/DatesheetManagerPage";
import { ParentsListPage } from "../features/admin/parents/ParentsListPage";
import { SendMessageToParentPage } from "../features/admin/parents/SendMessageToParentPage";
import { ParentMessagesPage } from "../features/parent/messages/ParentMessagesPage";
import { ParentLiveClassesPage } from "../features/parent/live/ParentLiveClassesPage";
import { ParentVideosPage } from "../features/parent/videos/ParentVideosPage";
import { ParentBooksPage } from "../features/parent/books/ParentBooksPage";
import { ParentNoticesPage } from "../features/parent/notices/ParentNoticesPage";
import { ParentAssignmentsPage } from "../features/parent/assignments/ParentAssignmentsPage";
import { AdminVideosPage } from "../features/admin/lms/AdminVideosPage";
import { AdminBooksPage } from "../features/admin/lms/AdminBooksPage";
import { AdminSettingsPage } from "../features/admin/settings/AdminSettingsPage";
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
import { TeacherLiveClassesPage } from "../features/teacher/live/TeacherLiveClassesPage";
import { TeacherVideosPage } from "../features/teacher/videos/TeacherVideosPage";
import { TeacherBooksPage } from "../features/teacher/books/TeacherBooksPage";
import { MyPayoutsPage } from "../features/teacher/payouts/MyPayoutsPage";
import { TeacherProfilePage } from "../features/teacher/TeacherProfilePage";
import { StudentDashboard } from "../features/student/StudentDashboard";
import { TimetablePage as StudentTimetablePage } from "../features/student/TimetablePage";
import { ResourceCenterPage } from "../features/student/resources/ResourceCenterPage";
import { AssignmentsPage as StudentAssignmentsPage } from "../features/student/assignments/AssignmentsPage";
import { QuizListPage as StudentQuizListPage } from "../features/student/quizzes/QuizListPage";
import { TakeQuizPage } from "../features/student/quizzes/TakeQuizPage";
import { StudentLiveClassesPage } from "../features/student/live/StudentLiveClassesPage";
import { StudentVideosPage } from "../features/student/videos/StudentVideosPage";
import { StudentBooksPage } from "../features/student/books/StudentBooksPage";
import { StudentAttendancePage } from "../features/student/attendance/StudentAttendancePage";
import { StudentProgressPage } from "../features/student/progress/StudentProgressPage";
import { StudentNoticesPage } from "../features/student/notices/StudentNoticesPage";
import { StudentHomeworkPage } from "../features/student/homework/StudentHomeworkPage";
import { StudentProfilePage } from "../features/student/profile/StudentProfilePage";
import { StudentExamSchedulePage } from "../features/student/exams/StudentExamSchedulePage";
import { QuizHistoryPage } from "../features/student/quizzes/QuizHistoryPage";
import { MyFeesPage } from "../features/student/fees/MyFeesPage";
import { MyMarksPage } from "../features/student/marks/MyMarksPage";
import { AdminQuizBuilderPage } from "../features/admin/lms/AdminQuizBuilderPage";
import { StudentAnalyticsPage } from "../features/admin/students/StudentAnalyticsPage";
import { ParentDashboard } from "../features/parent/ParentDashboard";
import { TimetablePage as ParentTimetablePage } from "../features/parent/TimetablePage";
import { AttendanceSummaryPage as ParentAttendanceSummaryPage } from "../features/parent/attendance/AttendanceSummaryPage";
import { ParentFeesPage } from "../features/parent/fees/ParentFeesPage";
import { GradebookPage as ParentGradebookPage } from "../features/parent/assignments/GradebookPage";
import { SuperAdminDashboard } from "../features/superAdmin/SuperAdminDashboard";
import { SchoolsPage } from "../features/superAdmin/SchoolsPage";

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
      {/* Super Admin routes */}
      <Route
        path="/super_admin"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/super_admin/schools"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <SchoolsPage />
          </ProtectedRoute>
        }
      />

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
        path="/admin/classes/sections"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <SectionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/classes/subjects"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <SubjectsPage />
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
        path="/admin/students/analytics"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StudentAnalyticsPage />
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
        path="/admin/students/documents"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StudentDocumentsPage />
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
      <Route path="/admin/fees/collect" element={<ProtectedRoute allowedRoles={["admin"]}><CollectFeePage /></ProtectedRoute>} />
      <Route path="/admin/fees/collect-family" element={<ProtectedRoute allowedRoles={["admin"]}><CollectFamilyFeePage /></ProtectedRoute>} />
      <Route path="/admin/fees/challan" element={<ProtectedRoute allowedRoles={["admin"]}><ViewChallanPage /></ProtectedRoute>} />
      <Route path="/admin/fees/security" element={<ProtectedRoute allowedRoles={["admin"]}><SecurityFeePage /></ProtectedRoute>} />
      <Route path="/admin/fees/heads" element={<ProtectedRoute allowedRoles={["admin"]}><FeeHeadsPage /></ProtectedRoute>} />
      <Route path="/admin/fees/slips" element={<ProtectedRoute allowedRoles={["admin"]}><SlipsPage /></ProtectedRoute>} />
      <Route path="/admin/fees/collection-reports" element={<ProtectedRoute allowedRoles={["admin"]}><FeeCollectionReportsPage /></ProtectedRoute>} />
      <Route path="/admin/fees/analytics" element={<ProtectedRoute allowedRoles={["admin"]}><FeeAnalyticsPage /></ProtectedRoute>} />
      <Route path="/admin/fees/create-challan" element={<ProtectedRoute allowedRoles={["admin"]}><CreateChallanPage /></ProtectedRoute>} />
      <Route path="/admin/fees/sms" element={<ProtectedRoute allowedRoles={["admin"]}><FeeSendSMSPage /></ProtectedRoute>} />
      <Route path="/admin/fees/settings" element={<ProtectedRoute allowedRoles={["admin"]}><FeeSettingPage /></ProtectedRoute>} />
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
        path="/admin/soon/:slug"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ComingSoonPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lms/live-classes"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLiveClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lms/lectures"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <VideoLecturesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lms/assignments"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminAssignmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lms/quizzes"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminQuizzesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lms/quizzes/new"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminQuizBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lms/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <LmsReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lms/videos"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminVideosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lms/books"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminBooksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/library/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <LibraryDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/library/items"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <BookItemsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/library/scan"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <QuickScanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/library/stocktake"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <StockAuditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/library/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <LibraryReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <FrontDeskDashboardPage />
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
        path="/admin/front-office/appointments"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppointmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office/lost-found"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <LostFoundPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/front-office/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <FrontDeskReportsPage />
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
      {/* ── People Directory ── */}
      <Route
        path="/admin/people-directory"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PeopleDirectoryPage />
          </ProtectedRoute>
        }
      />
      {/* ── Curriculum ── */}
      <Route
        path="/admin/curriculum"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <CurriculumPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/curriculum/subjects"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <CurriculumPage />
          </ProtectedRoute>
        }
      />
      {/* ── Date Sheet standalone ── */}
      <Route
        path="/admin/datesheet"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DatesheetManagerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/datesheet/view"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DatesheetManagerPage />
          </ProtectedRoute>
        }
      />
      {/* ── Attendance extras ── */}
      <Route
        path="/admin/attendance/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AttendanceReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/attendance/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AttendanceSettingsPage />
          </ProtectedRoute>
        }
      />
      {/* ── Admin Parents ── */}
      <Route
        path="/admin/parents"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ParentsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/parents/message"
        element={
          <ProtectedRoute allowedRoles={["admin", "teacher"]}>
            <SendMessageToParentPage />
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
      {/* ── Teacher new dedicated pages ── */}
      <Route
        path="/teacher/live"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherLiveClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/videos"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherVideosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/books"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherBooksPage />
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
        path="/teacher/profile"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/parents/message"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <SendMessageToParentPage />
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
      {/* ── Student new pages ── */}
      <Route
        path="/student/notices"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentNoticesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/homework"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentHomeworkPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/live-classes"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentLiveClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/videos"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentVideosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/books"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentBooksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/attendance"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentAttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/progress"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentProgressPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/quiz-history"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <QuizHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/exams"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentExamSchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/fees"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <MyFeesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/marks"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <MyMarksPage />
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
      <Route
        path="/parent/messages"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentMessagesPage />
          </ProtectedRoute>
        }
      />
      {/* ── Parent new pages ── */}
      <Route
        path="/parent/notices"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentNoticesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/assignments"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentAssignmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/live-classes"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentLiveClassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/videos"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentVideosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/books"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentBooksPage />
          </ProtectedRoute>
        }
      />
      {examsAdminRoutes.map((route) => <Route key={route.path} {...route} />)}
      <Route path="/admin/exams/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><ExamDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/exams/admit-cards" element={<ProtectedRoute allowedRoles={["admin"]}><AdmitCardsPage /></ProtectedRoute>} />
      <Route path="/admin/exams/print" element={<ProtectedRoute allowedRoles={["admin"]}><PrintReportsPage /></ProtectedRoute>} />
      <Route path="/admin/communication/notices" element={<ProtectedRoute allowedRoles={["admin"]}><NoticesPage /></ProtectedRoute>} />
      <Route path="/admin/communication/diary" element={<ProtectedRoute allowedRoles={["admin"]}><DiaryPage /></ProtectedRoute>} />
      <Route path="/admin/communication/messages" element={<ProtectedRoute allowedRoles={["admin"]}><MessagesPage /></ProtectedRoute>} />
      <Route path="/admin/communication/events" element={<ProtectedRoute allowedRoles={["admin"]}><EventsPage /></ProtectedRoute>} />
      <Route path="/admin/communication/todos" element={<ProtectedRoute allowedRoles={["admin"]}><TodosPage /></ProtectedRoute>} />
      <Route path="/admin/communication/sms" element={<ProtectedRoute allowedRoles={["admin"]}><SendSmsPage /></ProtectedRoute>} />
      <Route path="/admin/inventory/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><InventoryDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/inventory/catalog" element={<ProtectedRoute allowedRoles={["admin"]}><CatalogPage /></ProtectedRoute>} />
      <Route path="/admin/inventory/stock" element={<ProtectedRoute allowedRoles={["admin"]}><StockPage /></ProtectedRoute>} />
      <Route path="/admin/inventory/assets" element={<ProtectedRoute allowedRoles={["admin"]}><AssetsPage /></ProtectedRoute>} />
      <Route path="/admin/inventory/reports" element={<ProtectedRoute allowedRoles={["admin"]}><InventoryReportsPage /></ProtectedRoute>} />
      <Route path="/admin/inventory/requisitions" element={<ProtectedRoute allowedRoles={["admin"]}><RequisitionsPage /></ProtectedRoute>} />
      <Route path="/admin/payroll/runs" element={<ProtectedRoute allowedRoles={["admin"]}><PayRunsPage /></ProtectedRoute>} />
      <Route path="/admin/payroll/advances" element={<ProtectedRoute allowedRoles={["admin"]}><AdvancesPage /></ProtectedRoute>} />
      <Route path="/admin/pos/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><PosDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/pos/sale" element={<ProtectedRoute allowedRoles={["admin"]}><SaleTerminalPage /></ProtectedRoute>} />
      <Route path="/admin/pos/reports" element={<ProtectedRoute allowedRoles={["admin"]}><PosReportsPage /></ProtectedRoute>} />
      <Route path="/admin/settings/automation" element={<ProtectedRoute allowedRoles={["admin"]}><AutomationPage /></ProtectedRoute>} />
      <Route path="/admin/hifz/halqas" element={<ProtectedRoute allowedRoles={["admin"]}><HalqasPage /></ProtectedRoute>} />
      <Route path="/admin/hifz/enrolments" element={<ProtectedRoute allowedRoles={["admin"]}><EnrolmentsPage /></ProtectedRoute>} />
      <Route path="/admin/settings/promotion" element={<ProtectedRoute allowedRoles={["admin"]}><PromotionPage /></ProtectedRoute>} />
      <Route path="/admin/hifz/donors" element={<ProtectedRoute allowedRoles={["admin"]}><DonorsPage /></ProtectedRoute>} />
      <Route path="/admin/hifz/sponsorships" element={<ProtectedRoute allowedRoles={["admin"]}><SponsorshipsPage /></ProtectedRoute>} />
      <Route path="/admin/downloads" element={<ProtectedRoute allowedRoles={["admin"]}><DownloadCenterPage /></ProtectedRoute>} />
      <Route path="/admin/hr/recruitment" element={<ProtectedRoute allowedRoles={["admin"]}><RecruitmentPage /></ProtectedRoute>} />
      <Route path="/admin/attendance/holidays" element={<ProtectedRoute allowedRoles={["admin"]}><HolidayCalendarPage /></ProtectedRoute>} />

      {examsTeacherRoutes.map((route) => <Route key={route.path} {...route} />)}
      {examsStudentRoutes.map((route) => <Route key={route.path} {...route} />)}
      {examsParentRoutes.map((route) => <Route key={route.path} {...route} />)}
      {libraryAdminRoutes.map((route) => <Route key={route.path} {...route} />)}
      {libraryTeacherRoutes.map((route) => <Route key={route.path} {...route} />)}
      {libraryStudentRoutes.map((route) => <Route key={route.path} {...route} />)}
      {libraryParentRoutes.map((route) => <Route key={route.path} {...route} />)}
      {/* ── Alias / redirect fixes for navbar paths ── */}
      {/* /admin/schedule/timetable → AdminTimetablePage */}
      <Route path="/admin/schedule/timetable" element={<ProtectedRoute allowedRoles={["admin"]}><AdminTimetablePage /></ProtectedRoute>} />
      {/* /admin/lms/quiz-results → AdminQuizzesPage */}
      <Route path="/admin/lms/quiz-results" element={<ProtectedRoute allowedRoles={["admin"]}><AdminQuizzesPage /></ProtectedRoute>} />
      {/* /admin/fees/plans → FeePlansPage */}
      <Route path="/admin/fees/plans" element={<ProtectedRoute allowedRoles={["admin"]}><FeePlansPage /></ProtectedRoute>} />
      {/* /admin/fees/pending → PendingPaymentsPage */}
      <Route path="/admin/fees/pending" element={<ProtectedRoute allowedRoles={["admin"]}><PendingPaymentsPage /></ProtectedRoute>} />
      {/* ── Account pages — accessible to every authenticated role ── */}
      <Route path="/account/profile" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "teacher", "student", "parent"]}><ProfilePage /></ProtectedRoute>} />
      <Route path="/account/password" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "teacher", "student", "parent"]}><ChangePasswordPage /></ProtectedRoute>} />

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
