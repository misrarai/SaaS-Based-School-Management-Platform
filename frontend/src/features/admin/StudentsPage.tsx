import { useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SmsIcon from "@mui/icons-material/Sms";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PrintIcon from "@mui/icons-material/Print";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";
import { listClasses } from "../../api/classes";
import { getStudent, listStudents, reactivateStudent, withdrawStudent, type Student } from "../../api/students";
import { linkParent } from "../../api/parents";

// ── helpers ───────────────────────────────────────────────────────────────────

function currentSession() {
  const y = new Date().getFullYear();
  return `${y} - ${y + 1}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Top action bar (matches Skoolzoom style) ──────────────────────────────────

const ACTIVE_BG = "#c0392b";

function TopBtn({
  active,
  label,
  icon,
  to,
  onClick,
}: {
  active?: boolean;
  label: string;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
}) {
  const sx = {
    borderRadius: 1,
    fontWeight: 600,
    fontSize: 13,
    bgcolor: active ? ACTIVE_BG : "#fff",
    color: active ? "#fff" : "text.primary",
    border: "1px solid #d0d5dd",
    "&:hover": { bgcolor: active ? ACTIVE_BG : "#f0f0f0", borderColor: "#bbb" },
    px: 2,
  };
  if (to)
    return (
      <Button component={RouterLink} to={to} startIcon={icon} variant="outlined" sx={sx}>
        {label}
      </Button>
    );
  return (
    <Button startIcon={icon} variant="outlined" onClick={onClick} sx={sx}>
      {label}
    </Button>
  );
}

// ── Row actions menu ──────────────────────────────────────────────────────────

function RowMenu({
  student,
  onView,
  onWithdraw,
  onReactivate,
}: {
  student: Student;
  onView: () => void;
  onWithdraw: () => void;
  onReactivate: () => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => { onView(); setAnchor(null); }}>View Details</MenuItem>
        {student.status === "active" ? (
          <MenuItem onClick={() => { onWithdraw(); setAnchor(null); }} sx={{ color: "error.main" }}>Withdraw</MenuItem>
        ) : (
          <MenuItem onClick={() => { onReactivate(); setAnchor(null); }}>Reactivate</MenuItem>
        )}
      </Menu>
    </>
  );
}

// ── Dialogs (unchanged logic) ─────────────────────────────────────────────────

function WithdrawDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const withdraw = useMutation({
    mutationFn: () => withdrawStudent(student!.id, reason || undefined),
    onSuccess: () => { setReason(""); queryClient.invalidateQueries({ queryKey: ["students"] }); onClose(); },
  });
  return (
    <Dialog open={!!student} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Withdraw {student?.full_name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This deactivates their login and moves them to Old Students.
        </Typography>
        <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>Withdraw</Button>
      </DialogActions>
    </Dialog>
  );
}

function LinkParentForm({ studentId }: { studentId: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [relationship, setRelationship] = useState("");
  const link = useMutation({
    mutationFn: () => linkParent(studentId, { full_name: fullName, email, password, relationship_label: relationship || undefined }),
    onSuccess: () => { setFullName(""); setEmail(""); setPassword(""); setRelationship(""); },
  });
  return (
    <Stack spacing={1.5} component="form" sx={{ mt: 1 }} onSubmit={(e) => { e.preventDefault(); link.mutate(); }}>
      <Typography variant="subtitle2">Link a parent account</Typography>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
        <TextField size="small" label="Parent name" value={fullName} onChange={(e) => setFullName(e.target.value)} required sx={{ minWidth: 160 }} />
        <TextField size="small" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required sx={{ minWidth: 200 }} />
        <TextField size="small" label="Temp. password" value={password} onChange={(e) => setPassword(e.target.value)} required sx={{ minWidth: 150 }} />
        <TextField size="small" label="Relationship" placeholder="Father / Mother / Guardian" value={relationship} onChange={(e) => setRelationship(e.target.value)} sx={{ minWidth: 160 }} />
        <Button type="submit" variant="outlined" size="small" disabled={link.isPending}>Link parent</Button>
      </Stack>
      {link.isSuccess && <Alert severity="success">Parent account linked.</Alert>}
      {link.isError && <Alert severity="error">Could not link — check the email isn't already used.</Alert>}
    </Stack>
  );
}

function ViewStudentDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const detailQuery = useQuery({ queryKey: ["students", student?.id, "detail"], queryFn: () => getStudent(student!.id), enabled: !!student });
  const detail = detailQuery.data?.admission_detail;
  const rows: [string, string][] = student ? [
    ["Admission No.", student.admission_number ?? "—"],
    ["Full name", student.full_name],
    ["Email", student.email],
    ["Roll number", student.roll_number ?? "—"],
    ["Guardian name", student.guardian_name ?? "—"],
    ["Date of birth", student.date_of_birth ?? "—"],
    ["Admission date", student.admission_date ?? "—"],
    ["Status", student.status],
    ...(detail ? ([
      ["Father name", detail.father_name ?? "—"],
      ["Father mobile", detail.father_mobile ?? "—"],
      ["WhatsApp", detail.whatsapp_number ?? "—"],
      ["Mother name", detail.mother_name ?? "—"],
      ["Gender", detail.gender ?? "—"],
      ["Blood group", detail.blood_group ?? "—"],
      ["Category", detail.category ?? "—"],
    ] as [string, string][]) : []),
  ] : [];
  return (
    <Dialog open={!!student} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Student Details</DialogTitle>
      <DialogContent>
        {detailQuery.isLoading && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Loading…</Typography>}
        <Stack divider={<Divider />} spacing={1}>
          {rows.map(([label, value]) => (
            <Stack key={label} direction="row" sx={{ justifyContent: "space-between", py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right" }}>{value}</Typography>
            </Stack>
          ))}
        </Stack>
        {student && <><Divider sx={{ my: 2 }} /><LinkParentForm studentId={student.id} /></>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type StatusTab = "active" | "old" | "all";

export function StudentsPage() {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const VALID: StatusTab[] = ["active", "old", "all"];
  const [statusTab, setStatusTab] = useState<StatusTab>(VALID.includes(initialStatus as StatusTab) ? (initialStatus as StatusTab) : "active");
  const [filterClassId, setFilterClassId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [withdrawTarget, setWithdrawTarget] = useState<Student | null>(null);
  const [viewTarget, setViewTarget] = useState<Student | null>(null);

  const studentsQuery = useQuery({
    queryKey: ["students", filterClassId, statusTab, appliedSearch],
    queryFn: () => listStudents({ classGradeId: filterClassId || undefined, status: statusTab, query: appliedSearch || undefined }),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => reactivateStudent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });

  const students = studentsQuery.data ?? [];
  const classMap = Object.fromEntries((classesQuery.data ?? []).map((c) => [c.id, c.name]));

  const allSelected = students.length > 0 && selectedIds.size === students.length;
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(students.map((s) => s.id)));
  }
  function toggleOne(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  const SESSION_LABEL_MAP: Record<StatusTab, string> = {
    active: "Active Students",
    old: "Old / Withdrawn Students",
    all: "Admission Register",
  };
  const COUNT_MSG: Record<StatusTab, string> = {
    active: "students enrolled",
    old: "students in old records",
    all: "total admissions",
  };

  return (
    <AppShell title="Students" navItems={adminNavItems}>
      {/* Top action bar — Skoolzoom style */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <TopBtn active={statusTab === "active"} label="Students" icon={<PersonAddIcon fontSize="small" />} onClick={() => { setStatusTab("active"); setSearchParams({ status: "active" }); }} />
          <TopBtn label="Edit Bulk Students" icon={<EditIcon fontSize="small" />} to="/admin/students/register" />
          <TopBtn label="Send SMS" icon={<SmsIcon fontSize="small" />} onClick={() => {}} />
          <TopBtn label="Update Data (Via File)" icon={<UploadFileIcon fontSize="small" />} to="/admin/students/import" />
        </Stack>
      </Paper>

      {/* Filter card */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {SESSION_LABEL_MAP[statusTab]} of Session <span style={{ fontWeight: 800 }}>{currentSession()}</span>
        </Typography>

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
          {/* Search type dropdown */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)} displayEmpty>
              <MenuItem value="">Default Search</MenuItem>
              {classesQuery.data?.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Search text */}
          <TextField
            size="small"
            placeholder="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(searchInput)}
            sx={{ minWidth: 260 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />

          {/* Search button — green */}
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={() => setAppliedSearch(searchInput)}
            sx={{ bgcolor: "#22c55e", "&:hover": { bgcolor: "#16a34a" }, fontWeight: 600, borderRadius: 1 }}
          >
            Search
          </Button>

          {/* Advanced Search — teal */}
          <Button
            variant="contained"
            startIcon={<FilterListIcon />}
            sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" }, fontWeight: 600, borderRadius: 1 }}
          >
            Advanced Search
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          There are{" "}
          <Box component="span" sx={{ color: "error.main", fontWeight: 700 }}>
            {students.length}
          </Box>{" "}
          {COUNT_MSG[statusTab]} in session <strong>{currentSession()}</strong>
        </Typography>
      </Paper>

      {/* Status tabs */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        {(["active", "old", "all"] as StatusTab[]).map((tab) => (
          <Button
            key={tab}
            size="small"
            variant={statusTab === tab ? "contained" : "outlined"}
            onClick={() => { setStatusTab(tab); setSearchParams({ status: tab }); }}
            sx={{
              borderRadius: 1,
              bgcolor: statusTab === tab ? "#0e3550" : "#fff",
              color: statusTab === tab ? "#fff" : "text.primary",
              borderColor: "#d0d5dd",
              "&:hover": { bgcolor: statusTab === tab ? "#0e3550" : "#f5f5f5" },
            }}
          >
            {SESSION_LABEL_MAP[tab]}
          </Button>
        ))}
      </Stack>

      {/* Table */}
      {studentsQuery.isLoading && <Typography>Loading…</Typography>}

      {!studentsQuery.isLoading && students.length === 0 && (
        <Alert severity="info">
          {statusTab === "active"
            ? 'No active students — click "Edit Bulk Students" above to register the first one.'
            : "No students found."}
        </Alert>
      )}

      {students.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead
              sx={{
                bgcolor: "#0b5345",
                "& .MuiTableCell-head": { color: "#fff", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" },
              }}
            >
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox checked={allSelected} onChange={toggleAll} sx={{ color: "#fff", "&.Mui-checked": { color: "#fff" } }} size="small" />
                </TableCell>
                <TableCell>#</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Father Name</TableCell>
                <TableCell>WhatsApp</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Adm.No</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s, idx) => {
                const detail = s.admission_detail;
                const isSelected = selectedIds.has(s.id);
                return (
                  <TableRow key={s.id} hover selected={isSelected} sx={{ "&.Mui-selected": { bgcolor: "#f0fdf4" } }}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={isSelected} onChange={() => toggleOne(s.id)} />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{idx + 1}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                          src={detail?.photo_url ?? undefined}
                          sx={{ width: 32, height: 32, fontSize: 12, bgcolor: "#0b5345" }}
                        >
                          {initials(s.full_name)}
                        </Avatar>
                        <Typography
                          variant="body2"
                          sx={{ color: "primary.main", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                          onClick={() => setViewTarget(s)}
                        >
                          {s.full_name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{detail?.father_name ?? "—"}</TableCell>
                    <TableCell>
                      {detail?.whatsapp_number ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <WhatsAppIcon sx={{ fontSize: 14, color: "#25D366" }} />
                          <Typography variant="body2" sx={{ fontSize: 13 }}>{detail.whatsapp_number}</Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontSize: 13 }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {s.class_grade_id ? classMap[s.class_grade_id] ?? "—" : "—"}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{s.roll_number ?? "—"}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 600, fontSize: 13 }}>
                        {s.admission_number ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={s.status} color={s.status === "active" ? "success" : "default"} sx={{ fontSize: 11 }} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                        {/* Print button — yellow */}
                        <Button
                          size="small"
                          startIcon={<PrintIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            bgcolor: "#f59e0b",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            minWidth: 0,
                            px: 1,
                            borderRadius: 1,
                            "&:hover": { bgcolor: "#d97706" },
                          }}
                          onClick={() => window.print()}
                        >
                          Print
                        </Button>
                        <Tooltip title="Email student">
                          <IconButton size="small" href={`mailto:${s.email}`}>
                            <EmailIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View / Edit">
                          <IconButton size="small" onClick={() => setViewTarget(s)}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <RowMenu
                          student={s}
                          onView={() => setViewTarget(s)}
                          onWithdraw={() => setWithdrawTarget(s)}
                          onReactivate={() => reactivate.mutate(s.id)}
                        />
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <WithdrawDialog student={withdrawTarget} onClose={() => setWithdrawTarget(null)} />
      <ViewStudentDialog student={viewTarget} onClose={() => setViewTarget(null)} />
    </AppShell>
  );
}
