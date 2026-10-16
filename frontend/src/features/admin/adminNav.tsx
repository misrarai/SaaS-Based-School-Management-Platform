import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import PeopleIcon from "@mui/icons-material/PeopleOutlined";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import AutoStoriesIcon from "@mui/icons-material/AutoStoriesOutlined";
import EventNoteIcon from "@mui/icons-material/EventNoteOutlined";
import FactCheckIcon from "@mui/icons-material/FactCheckOutlined";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import LiveTvIcon from "@mui/icons-material/LiveTvOutlined";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import QuizIcon from "@mui/icons-material/QuizOutlined";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import ImportContactsIcon from "@mui/icons-material/ImportContactsOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import SavingsIcon from "@mui/icons-material/SavingsOutlined";
import AccountBalanceIcon from "@mui/icons-material/AccountBalanceOutlined";
import PointOfSaleIcon from "@mui/icons-material/PointOfSaleOutlined";
import RoomServiceIcon from "@mui/icons-material/RoomServiceOutlined";
import LocalLibraryIcon from "@mui/icons-material/LocalLibraryOutlined";
import Inventory2Icon from "@mui/icons-material/Inventory2Outlined";
import DirectionsBusIcon from "@mui/icons-material/DirectionsBusOutlined";
import ApartmentIcon from "@mui/icons-material/ApartmentOutlined";
import CampaignIcon from "@mui/icons-material/CampaignOutlined";
import AssessmentIcon from "@mui/icons-material/AssessmentOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import type { NavItem } from "../../components/AppShell";

const section = (label: string): NavItem => ({ label, kind: "section" });

export const peopleNav: NavItem[] = [
  section("People"),
  {
    label: "Students",
    to: "/admin/students",
    icon: <SchoolIcon fontSize="small" />,
    children: [
      { label: "Student Analytics", to: "/admin/students/analytics" },
      { label: "Active Students", to: "/admin/students" },
      { label: "Admission Register", to: "/admin/students/register" },
      { label: "Import Students", to: "/admin/students/import" },
      { label: "Family List", to: "/admin/families" },
      { label: "Old Students", to: "/admin/students/withdrawals" },
      { label: "Student Documents", to: "/admin/students/documents" },
      { label: "ID Cards", to: "/admin/students/cards" },
      { label: "Certificates", to: "/admin/students/certificates" },
      { label: "Extra Coaching", to: "/admin/students/extra-coaching" },
      { label: "Student Reports", to: "/admin/students/reports" },
    ],
  },
  {
    label: "Staff & HR",
    to: "/admin/teachers",
    icon: <BadgeIcon fontSize="small" />,
    children: [
      { label: "All Teachers", to: "/admin/teachers" },
      { label: "Staff", to: "/admin/staff" },
      { label: "People Directory", to: "/admin/people-directory" },
      { label: "Employees", to: "/admin/payroll/employees" },
      { label: "Departments", to: "/admin/payroll/departments" },
      { label: "Recruitment", to: "/admin/hr/recruitment" },
    ],
  },
  {
    label: "Parents",
    to: "/admin/parents",
    icon: <PeopleIcon fontSize="small" />,
    children: [
      { label: "All Parents", to: "/admin/parents" },
      { label: "Send Message", to: "/admin/parents/message" },
    ],
  },
];

export const academicsNav: NavItem[] = [
  section("Academics"),
  {
    label: "Classes",
    to: "/admin/classes",
    icon: <ClassIcon fontSize="small" />,
    children: [
      { label: "Class List", to: "/admin/classes" },
      { label: "Sections", to: "/admin/classes/sections" },
      { label: "Subjects", to: "/admin/classes/subjects" },
    ],
  },
  {
    label: "Curriculum",
    to: "/admin/curriculum",
    icon: <AutoStoriesIcon fontSize="small" />,
    children: [
      { label: "Curriculum", to: "/admin/curriculum" },
      { label: "Courses", to: "/admin/courses" },
    ],
  },
  {
    label: "Timetable",
    to: "/admin/schedule",
    icon: <EventNoteIcon fontSize="small" />,
    children: [
      { label: "Class Timetable", to: "/admin/schedule" },
      { label: "Academic Years", to: "/admin/academic-years" },
    ],
  },
  {
    label: "Attendance",
    to: "/admin/attendance",
    icon: <FactCheckIcon fontSize="small" />,
    children: [
      { label: "Student Attendance", to: "/admin/attendance" },
      { label: "Teacher Attendance", to: "/admin/attendance/teachers" },
      { label: "Staff Attendance", to: "/admin/attendance/staff" },
      { label: "Attendance Reports", to: "/admin/attendance/reports" },
      { label: "Holiday Calendar", to: "/admin/attendance/holidays" },
      { label: "Attendance Settings", to: "/admin/attendance/settings" },
    ],
  },
  {
    label: "Examinations",
    to: "/admin/exams",
    icon: <AssignmentTurnedInIcon fontSize="small" />,
    children: [
      { label: "Exam Dashboard", to: "/admin/exams/dashboard" },
      { label: "Exams & Datesheets", to: "/admin/exams" },
      { label: "Grading Schemes", to: "/admin/exams/grading-schemes" },
      { label: "Marks Entry", to: "/admin/exams/marks" },
      { label: "Results / Tabulation", to: "/admin/exams/results" },
      { label: "Date Sheet Manager", to: "/admin/datesheet" },
      { label: "Admit Cards", to: "/admin/exams/admit-cards" },
      { label: "Print Exam Docs", to: "/admin/exams/print" },
    ],
  },
  {
    label: "Hifz",
    to: "/admin/hifz/halqas",
    icon: <MenuBookIcon fontSize="small" />,
    children: [
      { label: "Halqas", to: "/admin/hifz/halqas" },
      { label: "Enrolments", to: "/admin/hifz/enrolments" },
      { label: "Sponsorships", to: "/admin/hifz/sponsorships" },
      { label: "Donors", to: "/admin/hifz/donors" },
    ],
  },
];

export const lmsNav: NavItem[] = [
  section("Teaching & LMS"),
  {
    label: "Live Classes",
    to: "/admin/lms/live-classes",
    icon: <LiveTvIcon fontSize="small" />,
  },
  {
    label: "Video Lectures",
    to: "/admin/lms/videos",
    icon: <VideoLibraryIcon fontSize="small" />,
    children: [
      { label: "All Videos", to: "/admin/lms/videos" },
      { label: "Lecture Library", to: "/admin/lms/lectures" },
    ],
  },
  {
    label: "Quizzes",
    to: "/admin/lms/quizzes",
    icon: <QuizIcon fontSize="small" />,
    children: [
      { label: "All Quizzes", to: "/admin/lms/quizzes" },
      { label: "Create Quiz", to: "/admin/lms/quizzes/new" },
      { label: "LMS Reports", to: "/admin/lms/reports" },
    ],
  },
  {
    label: "Assignments",
    to: "/admin/lms/assignments",
    icon: <AssignmentIcon fontSize="small" />,
  },
  {
    label: "E-Books",
    to: "/admin/lms/books",
    icon: <ImportContactsIcon fontSize="small" />,
  },
];

export const financeNav: NavItem[] = [
  section("Finance"),
  {
    label: "Fees",
    to: "/admin/fees",
    icon: <PaymentsIcon fontSize="small" />,
    children: [
      { label: "Fee Plans", to: "/admin/fees" },
      { label: "Invoices", to: "/admin/fees/invoices" },
      { label: "Verify Payments", to: "/admin/fees/payments" },
      { label: "All Payments", to: "/admin/fees/payments/all" },
      { label: "Pending Payments", to: "/admin/fees/payments/pending" },
      { label: "Subscriptions", to: "/admin/fees/subscriptions" },
      { label: "Receipts", to: "/admin/fees/receipts" },
      { label: "Fee Reports", to: "/admin/fees/reports" },
    ],
  },
  {
    label: "Payroll",
    to: "/admin/payroll/runs",
    icon: <AccountBalanceWalletIcon fontSize="small" />,
    children: [
      { label: "Payroll Runs", to: "/admin/payroll/runs" },
      { label: "Salary Structures", to: "/admin/payroll/salary-structures" },
      { label: "Advances", to: "/admin/payroll/advances" },
      { label: "Leave Requests", to: "/admin/payroll/leaves" },
      { label: "Leave Types", to: "/admin/payroll/leave-types" },
    ],
  },
  {
    label: "Teacher Payouts",
    to: "/admin/payouts",
    icon: <SavingsIcon fontSize="small" />,
    children: [
      { label: "Payouts", to: "/admin/payouts" },
      { label: "Payout Rates", to: "/admin/payouts/rates" },
    ],
  },
  {
    label: "Accounting",
    to: "/admin/accounting/accounts",
    icon: <AccountBalanceIcon fontSize="small" />,
    children: [
      { label: "Chart of Accounts", to: "/admin/accounting/accounts" },
      { label: "Income & Expenses", to: "/admin/accounting/income-expenses" },
      { label: "Vouchers", to: "/admin/accounting/vouchers" },
    ],
  },
  {
    label: "Point of Sale",
    to: "/admin/pos/dashboard",
    icon: <PointOfSaleIcon fontSize="small" />,
    children: [
      { label: "POS Dashboard", to: "/admin/pos/dashboard" },
      { label: "New Sale", to: "/admin/pos/sale" },
      { label: "POS Reports", to: "/admin/pos/reports" },
    ],
  },
];

export const operationsNav: NavItem[] = [
  section("Operations"),
  {
    label: "Front Office",
    to: "/admin/front-office",
    icon: <RoomServiceIcon fontSize="small" />,
    children: [
      { label: "Front Desk", to: "/admin/front-office" },
      { label: "Admission Enquiries", to: "/admin/front-office/enquiries" },
      { label: "Visitor Book", to: "/admin/front-office/visitors" },
      { label: "Phone Call Log", to: "/admin/front-office/calls" },
      { label: "Postal Register", to: "/admin/front-office/postal" },
      { label: "Complaints", to: "/admin/front-office/complaints" },
      { label: "Appointments", to: "/admin/front-office/appointments" },
      { label: "Gate Passes", to: "/admin/front-office/gate-passes" },
      { label: "Lost & Found", to: "/admin/front-office/lost-found" },
      { label: "Front Office Reports", to: "/admin/front-office/reports" },
    ],
  },
  {
    label: "Library",
    to: "/admin/library/dashboard",
    icon: <LocalLibraryIcon fontSize="small" />,
    children: [
      { label: "Library Dashboard", to: "/admin/library/dashboard" },
      { label: "Catalogue", to: "/admin/library" },
      { label: "Book Items", to: "/admin/library/items" },
      { label: "Issue / Return Desk", to: "/admin/library/circulation" },
      { label: "Quick Scan", to: "/admin/library/scan" },
      { label: "Reservations", to: "/admin/library/reservations" },
      { label: "Overdue & Fines", to: "/admin/library/fines" },
      { label: "Stocktake", to: "/admin/library/stocktake" },
      { label: "Library Reports", to: "/admin/library/reports" },
      { label: "Library Settings", to: "/admin/library/settings" },
    ],
  },
  {
    label: "Inventory",
    to: "/admin/inventory/dashboard",
    icon: <Inventory2Icon fontSize="small" />,
    children: [
      { label: "Inventory Dashboard", to: "/admin/inventory/dashboard" },
      { label: "Catalog", to: "/admin/inventory/catalog" },
      { label: "Stock", to: "/admin/inventory/stock" },
      { label: "Requisitions", to: "/admin/inventory/requisitions" },
      { label: "Assets", to: "/admin/inventory/assets" },
      { label: "Inventory Reports", to: "/admin/inventory/reports" },
    ],
  },
  {
    label: "Transport",
    to: "/admin/transport/routes",
    icon: <DirectionsBusIcon fontSize="small" />,
    children: [
      { label: "Routes", to: "/admin/transport/routes" },
      { label: "Vehicles", to: "/admin/transport/vehicles" },
      { label: "Drivers", to: "/admin/transport/drivers" },
      { label: "Allocations", to: "/admin/transport/allocations" },
      { label: "Transport Fees", to: "/admin/transport/fees" },
      { label: "Transport Reports", to: "/admin/transport/reports" },
    ],
  },
  {
    label: "Hostel",
    to: "/admin/hostel",
    icon: <ApartmentIcon fontSize="small" />,
    children: [
      { label: "Hostels", to: "/admin/hostel" },
      { label: "Room Allocations", to: "/admin/hostel/allocations" },
    ],
  },
];

export const communicationNav: NavItem[] = [
  section("Communication"),
  {
    label: "Communication",
    to: "/admin/communication/notices",
    icon: <CampaignIcon fontSize="small" />,
    children: [
      { label: "Notice Board", to: "/admin/communication/notices" },
      { label: "Messages", to: "/admin/communication/messages" },
      { label: "Send SMS", to: "/admin/communication/sms" },
      { label: "Events", to: "/admin/communication/events" },
      { label: "Student Diary", to: "/admin/communication/diary" },
      { label: "To-Dos", to: "/admin/communication/todos" },
      { label: "Notifications", to: "/admin/notifications" },
      { label: "Download Center", to: "/admin/downloads" },
    ],
  },
];

export const systemNav: NavItem[] = [
  section("System"),
  {
    label: "Reports",
    to: "/admin/students/reports",
    icon: <AssessmentIcon fontSize="small" />,
    children: [
      { label: "Student Reports", to: "/admin/students/reports" },
      { label: "Attendance Reports", to: "/admin/attendance/reports" },
      { label: "Fee Reports", to: "/admin/fees/reports" },
      { label: "LMS Reports", to: "/admin/lms/reports" },
      { label: "Library Reports", to: "/admin/library/reports" },
      { label: "Front Office Reports", to: "/admin/front-office/reports" },
      { label: "Inventory Reports", to: "/admin/inventory/reports" },
      { label: "Transport Reports", to: "/admin/transport/reports" },
      { label: "POS Reports", to: "/admin/pos/reports" },
    ],
  },
  {
    label: "Settings",
    to: "/admin/settings",
    icon: <SettingsIcon fontSize="small" />,
    children: [
      { label: "All Settings", to: "/admin/settings" },
      { label: "Academic Years", to: "/admin/academic-years" },
      { label: "Student Promotion", to: "/admin/settings/promotion" },
      { label: "Automation", to: "/admin/settings/automation" },
    ],
  },
];

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: <DashboardIcon fontSize="small" /> },
  ...peopleNav,
  ...academicsNav,
  ...lmsNav,
  ...financeNav,
  ...operationsNav,
  ...communicationNav,
  ...systemNav,
];
