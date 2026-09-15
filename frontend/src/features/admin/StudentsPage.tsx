import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";
import { darkTableHeadSx } from "../../components/tableStyles";
import { StudentsActionBar } from "./students/StudentsActionBar";
import { listClasses } from "../../api/classes";
import { getStudent, listStudents, reactivateStudent, withdrawStudent, type Student } from "../../api/students";
import { linkParent } from "../../api/parents";

type StatusTab = "active" | "old" | "all";

const TAB_LABELS: Record<StatusTab, string> = {
  active: "Active Students",
  old: "Old Students",
  all: "Admission Register",
};

const COUNT_LABELS: Record<StatusTab, string> = {
  active: "active students enrolled",
  old: "students in old / withdrawn records",
  all: "admissions saved in the system",
};

const VALID_STATUS_TABS: StatusTab[] = ["active", "old", "all"];

function StatusPillTabs({ value, onChange }: { value: StatusTab; onChange: (next: StatusTab) => void }) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
      {VALID_STATUS_TABS.map((key) => {
        const selected = key === value;
        return (
          <Button
            key={key}
            onClick={() => onChange(key)}
            variant={selected ? "contained" : "outlined"}
            size="small"
            sx={{
              borderRadius: 1,
              bgcolor: selected ? "#0e3550" : "#fff",
              color: selected ? "#fff" : "text.primary",
              borderColor: "#d0d5dd",
              "&:hover": { bgcolor: selected ? "#0e3550" : "#f5f5f5", borderColor: "#d0d5dd" },
            }}
          >
            {TAB_LABELS[key]}
          </Button>
        );
      })}
    </Stack>
  );
}

function WithdrawDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const withdraw = useMutation({
    mutationFn: () => withdrawStudent(student!.id, reason || undefined),
    onSuccess: () => {
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
  });

  return (
    <Dialog open={!!student} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Withdraw {student?.full_name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This deactivates their login and moves them to Old Students. This can be undone with Reactivate.
        </Typography>
        <TextField
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          multiline
          minRows={2}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
          Withdraw
        </Button>
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
    mutationFn: () =>
      linkParent(studentId, {
        full_name: fullName,
        email,
        password,
        relationship_label: relationship || undefined,
      }),
    onSuccess: () => {
      setFullName("");
      setEmail("");
      setPassword("");
      setRelationship("");
    },
  });

  return (
    <Stack
      spacing={1.5}
      component="form"
      sx={{ mt: 1 }}
      onSubmit={(e) => {
        e.preventDefault();
        link.mutate();
      }}
    >
      <Typography variant="subtitle2">Link a parent account</Typography>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
        <TextField
          size="small"
          label="Parent name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          sx={{ minWidth: 160 }}
        />
        <TextField
          size="small"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          sx={{ minWidth: 200 }}
        />
        <TextField
          size="small"
          label="Temp. password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          label="Relationship"
          placeholder="Father / Mother / Guardian"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          sx={{ minWidth: 160 }}
        />
        <Button type="submit" variant="outlined" size="small" disabled={link.isPending}>
          Link parent
        </Button>
      </Stack>
      {link.isSuccess && <Alert severity="success">Parent account linked.</Alert>}
      {link.isError && <Alert severity="error">Could not link this parent — check the email isn't already used differently.</Alert>}
    </Stack>
  );
}

function ViewStudentDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ["students", student?.id, "detail"],
    queryFn: () => getStudent(student!.id),
    enabled: !!student,
  });
  const detail = detailQuery.data?.admission_detail;
  const rows: [string, string][] = student
    ? [
        ["Admission No.", student.admission_number ?? "—"],
        ["Full name", student.full_name],
        ["Email", student.email],
        ["Roll number", student.roll_number ?? "—"],
        ["Guardian name", student.guardian_name ?? "—"],
        ["Date of birth", student.date_of_birth ?? "—"],
        ["Admission date", student.admission_date ?? "—"],
        ["Status", student.status],
        ["Withdrawal date", student.withdrawal_date ?? "—"],
        ["Withdrawal reason", student.withdrawal_reason ?? "—"],
        ...(detail
          ? ([
              ["Father name", detail.father_name ?? "—"],
              ["Father mobile", detail.father_mobile ?? "—"],
              ["Mother name", detail.mother_name ?? "—"],
              ["Gender", detail.gender ?? "—"],
              ["Blood group", detail.blood_group ?? "—"],
              ["Category", detail.category ?? "—"],
            ] as [string, string][])
          : []),
      ]
    : [];

  return (
    <Dialog open={!!student} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Student details</DialogTitle>
      <DialogContent>
        {detailQuery.isLoading && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Loading full details…
          </Typography>
        )}
        <Stack divider={<Divider />} spacing={1}>
          {rows.map(([label, value]) => (
            <Stack key={label} direction="row" sx={{ justifyContent: "space-between", py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right" }}>
                {value}
              </Typography>
            </Stack>
          ))}
        </Stack>
        {student && (
          <>
            <Divider sx={{ my: 2 }} />
            <LinkParentForm studentId={student.id} />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export function StudentsPage() {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });

  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [statusTab, setStatusTab] = useState<StatusTab>(
    VALID_STATUS_TABS.includes(initialStatus as StatusTab) ? (initialStatus as StatusTab) : "active",
  );
  const [filterClassId, setFilterClassId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  function handleTabChange(next: StatusTab) {
    setStatusTab(next);
    setSearchParams({ status: next });
  }

  const studentsQuery = useQuery({
    queryKey: ["students", filterClassId, statusTab, appliedSearch],
    queryFn: () =>
      listStudents({ classGradeId: filterClassId || undefined, status: statusTab, query: appliedSearch || undefined }),
  });

  const [withdrawTarget, setWithdrawTarget] = useState<Student | null>(null);
  const [viewTarget, setViewTarget] = useState<Student | null>(null);

  const reactivate = useMutation({
    mutationFn: (studentId: string) => reactivateStudent(studentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });

  return (
    <AppShell title="Students" navItems={adminNavItems}>
      <Stack sx={{ mb: 2 }}>
        <StudentsActionBar active="register-view" />
      </Stack>

      <StatusPillTabs value={statusTab} onChange={handleTabChange} />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          {TAB_LABELS[statusTab]}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="filter-class-label">Filter by class</InputLabel>
            <Select
              labelId="filter-class-label"
              label="Filter by class"
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
            >
              <MenuItem value="">All classes</MenuItem>
              {classesQuery.data?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Search by name, email, roll #, or admission #"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(searchInput)}
            sx={{ minWidth: 320 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button variant="contained" color="success" onClick={() => setAppliedSearch(searchInput)}>
            Search
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          There are <strong>{studentsQuery.data?.length ?? 0}</strong> {COUNT_LABELS[statusTab]}.
        </Typography>
      </Paper>

      {studentsQuery.isLoading && <Typography>Loading…</Typography>}
      {studentsQuery.data?.length === 0 && (
        <Alert severity="info">
          {statusTab === "active"
            ? 'No active students found — click "Register New Student" above to enroll the first one.'
            : "No students found for this view."}
        </Alert>
      )}

      {!!studentsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Adm. No</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Roll #</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {studentsQuery.data.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.admission_number ?? "—"}</TableCell>
                  <TableCell>
                    <Typography
                      component="span"
                      sx={{ color: "primary.main", cursor: "pointer", fontWeight: 500 }}
                      onClick={() => setViewTarget(s)}
                    >
                      {s.full_name}
                    </Typography>
                  </TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.roll_number ?? "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status} color={s.status === "active" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={() => setViewTarget(s)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {s.status === "active" ? (
                      <Button size="small" color="error" onClick={() => setWithdrawTarget(s)}>
                        Withdraw
                      </Button>
                    ) : (
                      <Button size="small" onClick={() => reactivate.mutate(s.id)} disabled={reactivate.isPending}>
                        Reactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <WithdrawDialog student={withdrawTarget} onClose={() => setWithdrawTarget(null)} />
      <ViewStudentDialog student={viewTarget} onClose={() => setViewTarget(null)} />
    </AppShell>
  );
}
