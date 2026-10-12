import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import RoomServiceIcon from "@mui/icons-material/RoomServiceOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import EventNoteIcon from "@mui/icons-material/EventNoteOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import PaidIcon from "@mui/icons-material/PaidOutlined";
import AccountBalanceIcon from "@mui/icons-material/AccountBalanceOutlined";
import CloudDownloadIcon from "@mui/icons-material/CloudDownloadOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import AutoStoriesIcon from "@mui/icons-material/AutoStoriesOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import CastForEducationIcon from "@mui/icons-material/CastForEducationOutlined";
import PointOfSaleIcon from "@mui/icons-material/PointOfSaleOutlined";
import LocalLibraryIcon from "@mui/icons-material/LocalLibraryOutlined";
import HotelIcon from "@mui/icons-material/HotelOutlined";
import DirectionsBusIcon from "@mui/icons-material/DirectionsBusOutlined";
import Inventory2Icon from "@mui/icons-material/Inventory2Outlined";
import ExtensionIcon from "@mui/icons-material/ExtensionOutlined";
import SmsIcon from "@mui/icons-material/SmsOutlined";
import AssessmentIcon from "@mui/icons-material/AssessmentOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import GroupsIcon from "@mui/icons-material/GroupsOutlined";
import TuneIcon from "@mui/icons-material/TuneOutlined";
import PublicIcon from "@mui/icons-material/PublicOutlined";
import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import type { NavItem } from "../../components/AppShell";

/** Placeholder route for Forza-parity screens not yet implemented. */
const soon = (slug: string) => `/admin/soon/${slug}`;

/**
 * Admin sidebar laid out to match the Forza / Skoolzoom admin navigation — same groups,
 * same order. Items wired to a route that exists in this build link to it; the rest point
 * at a "planned" placeholder so the whole navbar is browsable while pages are built out.
 */
export const adminNavItems: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: <DashboardIcon fontSize="small" /> },

  {
    label: "Front Desk",
    to: "/admin/front-office",
    icon: <RoomServiceIcon fontSize="small" />,
    children: [
      { label: "Dashboard", to: "/admin/front-office" },
      { label: "Quick SMS", to: "/admin/communication/sms" },
      { label: "People Directory", to: soon("front-desk-people-directory") },
      { label: "Visitor In/Out", to: "/admin/front-office/visitors" },
      { label: "Admission Inquiry", to: "/admin/front-office/enquiries" },
      { label: "Parcel Management", to: "/admin/front-office/postal" },
      { label: "Call Log", to: "/admin/front-office/calls" },
      { label: "Appointments", to: "/admin/front-office/appointments" },
      { label: "Complaint Desk", to: "/admin/front-office/complaints" },
      { label: "Gate Pass", to: "/admin/front-office/gate-passes" },
      { label: "Notice Board", to: "/admin/communication/notices" },
      { label: "Discussion", to: "/admin/communication/messages" },
      { label: "Lost & Found", to: "/admin/front-office/lost-found" },
      { label: "Reports", to: "/admin/front-office/reports" },
    ],
  },

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

  {
    label: "Students",
    to: "/admin/students",
    icon: <SchoolIcon fontSize="small" />,
    children: [
      { label: "Student Dashboard", to: soon("student-dashboard") },
      { label: "Active Students", to: "/admin/students?status=active" },
      { label: "Family List", to: "/admin/families" },
      { label: "Admission Register", to: "/admin/students/register" },
      { label: "Old Students", to: "/admin/students?status=old" },
      { label: "Student Reports", to: "/admin/students/reports" },
      { label: "Student Documents", to: soon("student-documents") },
      { label: "Student Cards", to: "/admin/students/cards" },
      { label: "Student Certificates", to: "/admin/students/certificates" },
      { label: "Bulk Import", to: "/admin/students/import" },
      { label: "Registers · Withdrawals", to: "/admin/students/withdrawals" },
      { label: "Registers · Extra Coaching", to: "/admin/students/extra-coaching" },
      { label: "Registers · Alumni", to: soon("student-alumni") },
      { label: "Registers · Discipline", to: soon("student-discipline") },
      { label: "Registers · Vaccinations", to: soon("student-vaccinations") },
      { label: "Operations · Campus Transfers", to: soon("student-transfers") },
      { label: "Operations · Merge Duplicates", to: soon("student-merge") },
    ],
  },

  {
    label: "HR / Staff",
    to: "/admin/staff",
    icon: <BadgeIcon fontSize="small" />,
    children: [
      { label: "HR Dashboard", to: soon("hr-dashboard") },
      { label: "Active Staff", to: "/admin/staff?status=active" },
      { label: "Old Staff", to: "/admin/staff?status=inactive" },
      { label: "Teachers", to: "/admin/teachers" },
      { label: "Staff Reports", to: soon("hr-staff-reports") },
      { label: "Staff Documents", to: soon("hr-staff-documents") },
      { label: "Staff Cards", to: soon("hr-staff-cards") },
      { label: "Org Chart", to: soon("hr-org-chart") },
      { label: "Appraisals · Dashboard", to: soon("hr-appraisal-dashboard") },
      { label: "Appraisals · Cycles", to: soon("hr-appraisal-cycles") },
      { label: "Appraisals · Forms", to: soon("hr-appraisal-forms") },
      { label: "Recruitment · Dashboard", to: "/admin/hr/recruitment" },
      { label: "Recruitment · Job Vacancies", to: "/admin/hr/recruitment" },
      { label: "Recruitment · Candidates", to: "/admin/hr/recruitment" },
      { label: "Recruitment · Applications", to: "/admin/hr/recruitment" },
      { label: "Recruitment · Interviews", to: "/admin/hr/recruitment" },
      { label: "L&D · Dashboard", to: soon("hr-training-dashboard") },
      { label: "L&D · Training Needs", to: soon("hr-training-needs") },
      { label: "L&D · Programs", to: soon("hr-training-programs") },
      { label: "L&D · Compliance", to: soon("hr-training-compliance") },
      { label: "Disciplinary Cases", to: soon("hr-disciplinary-cases") },
      { label: "Grievances", to: soon("hr-grievances") },
      { label: "HR Settings", to: soon("hr-settings") },
    ],
  },

  {
    label: "Attendance",
    to: "/admin/attendance",
    icon: <FactCheckIcon fontSize="small" />,
    children: [
      { label: "Staff Attendance", to: "/admin/attendance/staff" },
      { label: "Student Attendance", to: "/admin/attendance" },
      { label: "Teacher Attendance", to: "/admin/attendance/teachers" },
      { label: "Leave · Staff Requests", to: "/admin/payroll/leaves" },
      { label: "Leave · Student Requests", to: soon("attendance-student-leaves") },
      { label: "Leave · Corrections", to: soon("attendance-regularizations") },
      { label: "Attendance Reports", to: soon("attendance-reports") },
      { label: "Attendance Alerts", to: soon("attendance-alerts") },
      { label: "Leave Types", to: "/admin/payroll/leave-types" },
      { label: "Holiday Calendar", to: "/admin/attendance/holidays" },
      { label: "Attendance Settings", to: soon("attendance-settings") },
      { label: "Biometric · Devices", to: soon("attendance-devices") },
      { label: "Biometric · Punch Errors", to: soon("attendance-unmatched-punches") },
    ],
  },

  {
    label: "Classes",
    to: "/admin/classes",
    icon: <ClassIcon fontSize="small" />,
    children: [
      { label: "Class List", to: "/admin/classes" },
      { label: "Sections", to: soon("classes-sections") },
      { label: "Groups", to: soon("classes-groups") },
      { label: "Class Rooms", to: soon("classes-rooms") },
      { label: "Courses", to: "/admin/courses" },
      { label: "Academic Years", to: "/admin/academic-years" },
      { label: "Reports", to: soon("classes-reports") },
    ],
  },

  {
    label: "Timetable",
    to: "/admin/schedule",
    icon: <CalendarMonthIcon fontSize="small" />,
    children: [
      { label: "Create", to: "/admin/schedule" },
      { label: "Substitutions", to: soon("timetable-substitutions") },
      { label: "Electives", to: soon("timetable-electives") },
      { label: "Reports", to: soon("timetable-reports") },
      { label: "Analytics", to: soon("timetable-analytics") },
      { label: "Settings", to: soon("timetable-settings") },
    ],
  },

  {
    label: "Date Sheet",
    to: soon("datesheet-create"),
    icon: <EventNoteIcon fontSize="small" />,
    children: [
      { label: "Create", to: soon("datesheet-create") },
      { label: "View Date Sheet", to: soon("datesheet-view") },
      { label: "Reports", to: soon("datesheet-reports") },
      { label: "Exam Halls", to: soon("datesheet-halls") },
      { label: "Settings", to: soon("datesheet-settings") },
    ],
  },

  {
    label: "Fee",
    to: "/admin/fees",
    icon: <PaymentsIcon fontSize="small" />,
    children: [
      { label: "Collect Fee", to: "/admin/fees/payments/all" },
      { label: "Collect Family Fee", to: soon("fee-family-collection") },
      { label: "View Challan", to: "/admin/fees/invoices" },
      { label: "Security Fee", to: soon("fee-security") },
      { label: "Fee Heads", to: "/admin/fees" },
      { label: "Slips", to: "/admin/fees/receipts" },
      { label: "Reports", to: "/admin/fees/reports" },
      { label: "Fee Analytics", to: soon("fee-analytics") },
      { label: "Create Challan", to: soon("fee-create") },
      { label: "Send SMS", to: soon("fee-defaulter-sms") },
      { label: "Pending Payments", to: "/admin/fees/payments/pending" },
      { label: "Payment Verification", to: "/admin/fees/payments" },
      { label: "Subscriptions", to: "/admin/fees/subscriptions" },
      { label: "Fee Settings", to: soon("fee-settings") },
    ],
  },

  {
    label: "Payroll",
    to: "/admin/payroll/employees",
    icon: <PaidIcon fontSize="small" />,
    children: [
      { label: "Pay Salary", to: "/admin/payroll/runs" },
      { label: "View Salary Slips", to: "/admin/payroll/runs" },
      { label: "Security Deposits", to: soon("payroll-security") },
      { label: "Deductions", to: "/admin/payroll/salary-structures" },
      { label: "Allowances", to: "/admin/payroll/salary-structures" },
      { label: "Staff Loans", to: "/admin/payroll/advances" },
      { label: "Create Salary", to: "/admin/payroll/salary-structures" },
      { label: "Reports", to: "/admin/payroll/runs" },
      { label: "Statutory Report", to: soon("payroll-statutory") },
      { label: "Employees", to: "/admin/payroll/employees" },
      { label: "Departments", to: "/admin/payroll/departments" },
      { label: "Salary Structures", to: "/admin/payroll/salary-structures" },
      { label: "Leave Requests", to: "/admin/payroll/leaves" },
      { label: "Leave Types", to: "/admin/payroll/leave-types" },
      { label: "Teacher Payouts", to: "/admin/payouts" },
      { label: "Payout Rates", to: "/admin/payouts/rates" },
      { label: "Settings", to: soon("payroll-settings") },
    ],
  },

  {
    label: "Accounting",
    to: "/admin/accounting/accounts",
    icon: <AccountBalanceIcon fontSize="small" />,
    children: [
      { label: "Accounts", to: "/admin/accounting/accounts" },
      { label: "Expenses", to: "/admin/accounting/income-expenses" },
      { label: "Income", to: "/admin/accounting/income-expenses" },
      { label: "Day Book", to: soon("accounting-cashbook") },
      { label: "Income Statement", to: soon("accounting-istatement") },
      { label: "Vouchers", to: "/admin/accounting/vouchers" },
      { label: "Reports", to: soon("accounting-reports") },
    ],
  },

  {
    label: "Download Center",
    to: "/admin/downloads",
    icon: <CloudDownloadIcon fontSize="small" />,
    children: [
      { label: "Syllabus", to: "/admin/downloads" },
      { label: "Study Material", to: "/admin/downloads" },
      { label: "Others", to: "/admin/downloads" },
    ],
  },

  {
    label: "Curriculum",
    to: soon("curriculum-subjects"),
    icon: <MenuBookIcon fontSize="small" />,
    children: [
      { label: "Subjects", to: soon("curriculum-subjects") },
      { label: "Diary", to: soon("curriculum-diary") },
      { label: "Reports", to: soon("curriculum-reports") },
    ],
  },

  {
    label: "Hifz",
    to: "/admin/hifz/enrolments",
    icon: <AutoStoriesIcon fontSize="small" />,
    children: [
      { label: "Daily Entry", to: "/admin/hifz/enrolments" },
      { label: "Halqas", to: "/admin/hifz/halqas" },
      { label: "Enrolments", to: "/admin/hifz/enrolments" },
      { label: "Progress", to: "/admin/hifz/enrolments" },
      { label: "Qaida Books", to: soon("hifz-books") },
      { label: "Donors", to: "/admin/hifz/donors" },
      { label: "Donations", to: "/admin/hifz/donors" },
      { label: "Sponsorships", to: "/admin/hifz/sponsorships" },
      { label: "Reports", to: soon("hifz-reports") },
      { label: "Settings", to: soon("hifz-settings") },
    ],
  },

  {
    label: "Examination",
    to: "/admin/exams/dashboard",
    icon: <AssignmentIcon fontSize="small" />,
    children: [
      { label: "Dashboard", to: "/admin/exams/dashboard" },
      { label: "Exams", to: "/admin/exams" },
      { label: "Marks Entry", to: "/admin/exams/marks" },
      { label: "Results", to: "/admin/exams/results" },
      { label: "Print Reports", to: "/admin/exams/print" },
      { label: "Exam Office · Admit Cards", to: "/admin/exams/admit-cards" },
      { label: "Exam Office · Rechecks", to: soon("exam-rechecks") },
      { label: "Competency · Outcome Assessment", to: soon("exam-outcome-entry") },
      { label: "Competency · Co-scholastic", to: soon("exam-behaviour") },
      { label: "Consolidated · Composed Results", to: soon("exam-composed-results") },
      { label: "Consolidated · Board Results", to: soon("exam-external") },
      { label: "Analytics", to: soon("exam-analytics") },
      { label: "Data Exports", to: soon("exam-exports") },
      { label: "Competency Frameworks", to: soon("exam-frameworks") },
      { label: "Settings", to: "/admin/exams/grading-schemes" },
    ],
  },

  {
    label: "Coursework",
    to: soon("coursework-marks"),
    icon: <AssignmentTurnedInIcon fontSize="small" />,
    children: [
      { label: "Update Marks", to: soon("coursework-marks") },
      { label: "Create Assessment", to: soon("coursework-assessments") },
      { label: "Create Test", to: soon("coursework-tests") },
      { label: "Create Terms", to: soon("coursework-terms") },
      { label: "Print Exam Reports", to: soon("coursework-reports") },
      { label: "Send Results", to: soon("coursework-sms") },
      { label: "Academics Settings", to: soon("coursework-settings") },
    ],
  },

  {
    label: "LMS",
    to: soon("lms-live-classes"),
    icon: <CastForEducationIcon fontSize="small" />,
    children: [
      { label: "Live Classes", to: "/admin/lms/live-classes" },
      { label: "Video Lectures", to: "/admin/lms/lectures" },
      { label: "Assignments", to: "/admin/lms/assignments" },
      { label: "Quizzes", to: "/admin/lms/quizzes" },
      { label: "Reports", to: "/admin/lms/reports" },
    ],
  },

  {
    label: "Point of Sale",
    to: soon("pos-dashboard"),
    icon: <PointOfSaleIcon fontSize="small" />,
    children: [
      { label: "Dashboard", to: "/admin/pos/dashboard" },
      { label: "Sale", to: "/admin/pos/sale" },
      { label: "Purchase", to: "/admin/inventory/stock" },
      { label: "Products", to: "/admin/inventory/catalog" },
      { label: "Stock Adjustments", to: "/admin/inventory/stock" },
      { label: "Stock Transfers", to: "/admin/inventory/stock" },
      { label: "Supplier Payables", to: soon("pos-payables") },
      { label: "Reports", to: "/admin/pos/reports" },
      { label: "Settings", to: soon("pos-settings") },
    ],
  },

  {
    label: "Library",
    to: "/admin/library",
    icon: <LocalLibraryIcon fontSize="small" />,
    children: [
      { label: "Dashboard", to: "/admin/library/dashboard" },
      { label: "Books", to: "/admin/library" },
      { label: "Book Items", to: "/admin/library/items" },
      { label: "Circulation", to: "/admin/library/circulation" },
      { label: "Quick Scan", to: "/admin/library/scan" },
      { label: "Stock Audit", to: "/admin/library/stocktake" },
      { label: "Reservations", to: "/admin/library/reservations" },
      { label: "Fines", to: "/admin/library/fines" },
      { label: "Reports", to: "/admin/library/reports" },
      { label: "Settings", to: "/admin/library/settings" },
    ],
  },

  {
    label: "Hostel",
    to: "/admin/hostel",
    icon: <HotelIcon fontSize="small" />,
    children: [
      { label: "Dashboard", to: "/admin/hostel" },
      { label: "Residents / Allocations", to: "/admin/hostel/allocations" },
      { label: "Rooms", to: soon("hostel-rooms") },
      { label: "Buildings / Blocks", to: soon("hostel-blocks") },
      { label: "Inventory Items", to: soon("hostel-inventory") },
      { label: "Visitor Log", to: soon("hostel-visitors") },
      { label: "Requests", to: soon("hostel-requests") },
      { label: "Attendance", to: soon("hostel-attendance") },
      { label: "Leave / Gate Pass", to: soon("hostel-leave") },
      { label: "Reports", to: soon("hostel-reports") },
      { label: "Settings", to: soon("hostel-settings") },
    ],
  },

  {
    label: "Transport",
    to: "/admin/transport/vehicles",
    icon: <DirectionsBusIcon fontSize="small" />,
    children: [
      { label: "Dashboard", to: soon("transport-dashboard") },
      { label: "Passengers / Allocation", to: "/admin/transport/allocations" },
      { label: "Waitlist", to: soon("transport-waitlist") },
      { label: "Boarding Attendance", to: soon("transport-attendance") },
      { label: "Requests", to: soon("transport-requests") },
      { label: "Vehicles", to: "/admin/transport/vehicles" },
      { label: "Routes", to: "/admin/transport/routes" },
      { label: "Drivers", to: "/admin/transport/drivers" },
      { label: "Transport Fees", to: "/admin/transport/fees" },
      { label: "Transport Reports", to: "/admin/transport/reports" },
    ],
  },

  {
    label: "Inventory & Assets",
    to: "/admin/inventory/dashboard",
    icon: <Inventory2Icon fontSize="small" />,
    children: [
      { label: "Dashboard", to: "/admin/inventory/dashboard" },
      { label: "Assets", to: "/admin/inventory/assets" },
      { label: "Stationery / Stock", to: "/admin/inventory/stock" },
      { label: "Requisitions", to: "/admin/inventory/requisitions" },
      { label: "Catalog", to: "/admin/inventory/catalog" },
      { label: "Reports", to: "/admin/inventory/reports" },
    ],
  },

  {
    label: "Integrations",
    to: soon("integrations-sms-gateways"),
    icon: <ExtensionIcon fontSize="small" />,
    children: [
      { label: "SMS Gateways", to: soon("integrations-sms-gateways") },
      { label: "WhatsApp Gateways", to: soon("integrations-whatsapp-gateways") },
      { label: "Payment Gateways", to: soon("integrations-payment-gateways") },
      { label: "WhatsApp", to: soon("integrations-whatsapp") },
      { label: "Online Classes", to: soon("integrations-online-classes") },
    ],
  },

  { label: "Message Templates", to: soon("message-templates"), icon: <SmsIcon fontSize="small" /> },

  {
    label: "Reports & History",
    to: "/admin/notifications",
    icon: <AssessmentIcon fontSize="small" />,
    children: [
      { label: "Notifications", to: "/admin/notifications" },
      { label: "SMS History", to: soon("reports-sms") },
      { label: "Email Log", to: soon("reports-email-log") },
      { label: "Fee Analytics", to: "/admin/fees/reports" },
      { label: "Payroll Analytics", to: soon("reports-payroll") },
      { label: "Earning Report", to: soon("reports-earning") },
    ],
  },

  {
    label: "Settings",
    to: soon("settings-tags"),
    icon: <SettingsIcon fontSize="small" />,
    children: [
      { label: "Tags", to: soon("settings-tags") },
      { label: "Student Regions", to: soon("settings-regions") },
      { label: "Parent Professions", to: soon("settings-professions") },
      { label: "Nearby Institutes", to: soon("settings-schools") },
      { label: "Auto Notifications", to: "/admin/settings/automation" },
      { label: "Student Promotion", to: "/admin/settings/promotion" },
      { label: "Promotion Rules", to: "/admin/settings/promotion" },
      { label: "Campus Settings", to: soon("settings-campus") },
    ],
  },

  {
    label: "Team Management",
    to: soon("team-members"),
    icon: <GroupsIcon fontSize="small" />,
    children: [
      { label: "Team", to: soon("team-members") },
      { label: "Team Tasks", to: soon("team-tasks") },
      { label: "Activity Log", to: soon("team-activity") },
    ],
  },

  {
    label: "Configurations",
    to: soon("config-departments"),
    icon: <TuneIcon fontSize="small" />,
    children: [
      { label: "Departments", to: soon("config-departments") },
      { label: "Staff Designations", to: soon("config-roles") },
      { label: "Pay Scales", to: soon("config-payscales") },
      { label: "Allowances", to: soon("config-allowances") },
      { label: "Deductions", to: soon("config-deductions") },
      { label: "Student Categories", to: soon("config-categories") },
      { label: "Study Groups", to: soon("config-groups") },
      { label: "Sections", to: soon("config-sections") },
      { label: "Concession Types", to: soon("config-concessions") },
    ],
  },

  {
    label: "Global Options",
    to: soon("global-sessions"),
    icon: <PublicIcon fontSize="small" />,
    children: [
      { label: "Sessions", to: soon("global-sessions") },
      { label: "Update Log", to: soon("global-updates") },
    ],
  },
];
