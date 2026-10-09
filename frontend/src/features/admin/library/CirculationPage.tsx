import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { adminNavItems } from "../adminNav";
import {
  createLibraryMember,
  downloadLibraryCard,
  issueBook,
  libraryErrorMessage,
  listBookIssues,
  listLibraryMembers,
  renewBookIssue,
  returnBookIssue,
  returnByCopy,
  setLibraryMemberStatus,
  type BookIssue,
  type LibraryMember,
  type MemberType,
  type ReturnPayload,
} from "../../../api/library";
import { listStudents } from "../../../api/students";
import { listTeachers } from "../../../api/teachers";
import { listStaff } from "../../../api/staff";
import { IssuesTable, formatMoney, libraryAdminNav, withLibraryNav } from "../../libraryShared";

const navItems = withLibraryNav(adminNavItems, libraryAdminNav);

type Condition = "good" | "damaged" | "lost";

export function LibraryCirculationPage() {
  const [tab, setTab] = useState(0);
  return (
    <AppShell title="Library" navItems={navItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Issue / Return Desk
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Circulation" />
        <Tab label="Members" />
      </Tabs>
      {tab === 0 ? <CirculationPanel /> : <MembersPanel />}
    </AppShell>
  );
}

function CirculationPanel() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["library"] });
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const membersQuery = useQuery({ queryKey: ["library", "members", "all"], queryFn: () => listLibraryMembers() });
  const activeMembers = useMemo(() => (membersQuery.data ?? []).filter((m) => m.status === "active"), [membersQuery.data]);

  // Issue form
  const [member, setMember] = useState<LibraryMember | null>(null);
  const [copyCode, setCopyCode] = useState("");
  const [dueDate, setDueDate] = useState("");
  const issue = useMutation({
    mutationFn: () => issueBook({ member_id: member!.id, copy_identifier: copyCode.trim(), due_date: dueDate || undefined }),
    onSuccess: (res) => {
      setMessage({ severity: "success", text: `Issued "${res.book_title}" to ${res.member_name}, due ${res.due_date}.` });
      setCopyCode("");
      setDueDate("");
      refresh();
    },
    onError: (err) => setMessage({ severity: "error", text: libraryErrorMessage(err, "Could not issue the book.") }),
  });

  // Quick return form
  const [returnCode, setReturnCode] = useState("");
  const [returnCondition, setReturnCondition] = useState<Condition>("good");
  const [returnExtra, setReturnExtra] = useState("");
  const quickReturn = useMutation({
    mutationFn: () =>
      returnByCopy(returnCode.trim(), { condition: returnCondition, extra_fine: returnExtra ? Number(returnExtra) : 0 }),
    onSuccess: (res) => {
      setMessage({
        severity: "success",
        text: `Returned "${res.book_title}" from ${res.member_name}.${res.fine_amount > 0 ? ` Fine due: ${formatMoney(res.fine_amount)}.` : ""}`,
      });
      setReturnCode("");
      setReturnExtra("");
      setReturnCondition("good");
      refresh();
    },
    onError: (err) => setMessage({ severity: "error", text: libraryErrorMessage(err, "Could not return the book.") }),
  });

  // Active issues table
  const [search, setSearch] = useState("");
  const issuesQuery = useQuery({
    queryKey: ["library", "issues", "issued", search],
    queryFn: () => listBookIssues({ status: "issued", q: search || undefined }),
  });
  const [returning, setReturning] = useState<BookIssue | null>(null);
  const [dlgCondition, setDlgCondition] = useState<Condition>("good");
  const [dlgExtra, setDlgExtra] = useState("");
  const [dlgDate, setDlgDate] = useState("");
  const returnIssue = useMutation({
    mutationFn: (vars: { id: string; payload: ReturnPayload }) => returnBookIssue(vars.id, vars.payload),
    onSuccess: (res) => {
      setReturning(null);
      setMessage({
        severity: "success",
        text: `Returned "${res.book_title}".${res.fine_amount > 0 ? ` Fine due: ${formatMoney(res.fine_amount)}.` : ""}`,
      });
      refresh();
    },
    onError: (err) => setMessage({ severity: "error", text: libraryErrorMessage(err, "Could not return the book.") }),
  });
  const renew = useMutation({
    mutationFn: (id: string) => renewBookIssue(id),
    onSuccess: (res) => {
      setMessage({ severity: "success", text: `Renewed until ${res.due_date}.` });
      refresh();
    },
    onError: (err) => setMessage({ severity: "error", text: libraryErrorMessage(err, "Could not renew.") }),
  });

  return (
    <>
      {message && (
        <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 3 }}>
        <Paper
          variant="outlined"
          component="form"
          sx={{ p: 2, borderRadius: 2 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (member && copyCode.trim()) issue.mutate();
          }}
        >
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Issue a book
          </Typography>
          <Stack spacing={1.5}>
            <Autocomplete
              options={activeMembers}
              value={member}
              onChange={(_, v) => setMember(v)}
              getOptionLabel={(m) => `${m.full_name} (${m.card_number})`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={(props, m) => (
                <li {...props} key={m.id}>
                  <Box>
                    <Typography variant="body2">{m.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.card_number} · {m.member_type} · {m.active_issues} out
                      {m.outstanding_fine > 0 ? ` · fine ${formatMoney(m.outstanding_fine)}` : ""}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => <TextField {...params} size="small" label="Member" required />}
            />
            {member && member.outstanding_fine > 0 && (
              <Alert severity="warning">This member has an outstanding fine of {formatMoney(member.outstanding_fine)}.</Alert>
            )}
            <TextField
              size="small"
              label="Accession no. or barcode"
              value={copyCode}
              onChange={(e) => setCopyCode(e.target.value)}
              required
            />
            <TextField
              size="small"
              label="Due date (optional)"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              helperText="Defaults to the loan period for the member type"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button type="submit" variant="contained" disabled={issue.isPending || !member || !copyCode.trim()}>
              Issue
            </Button>
          </Stack>
        </Paper>

        <Paper
          variant="outlined"
          component="form"
          sx={{ p: 2, borderRadius: 2 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (returnCode.trim()) quickReturn.mutate();
          }}
        >
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Return a book
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label="Accession no. or barcode"
              value={returnCode}
              onChange={(e) => setReturnCode(e.target.value)}
              required
            />
            <TextField
              select
              size="small"
              label="Condition"
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value as Condition)}
            >
              <MenuItem value="good">Good</MenuItem>
              <MenuItem value="damaged">Damaged</MenuItem>
              <MenuItem value="lost">Lost (charges book price unless extra charge given)</MenuItem>
            </TextField>
            <TextField
              size="small"
              label="Extra damage/loss charge"
              type="number"
              value={returnExtra}
              onChange={(e) => setReturnExtra(e.target.value)}
            />
            <Button type="submit" variant="contained" color="secondary" disabled={quickReturn.isPending || !returnCode.trim()}>
              Return
            </Button>
          </Stack>
        </Paper>
      </Box>

      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h6">Books currently out ({issuesQuery.data?.length ?? 0})</Typography>
        <TextField
          size="small"
          placeholder="Search book, member, accession no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320, maxWidth: "100%" }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
          }}
        />
      </Stack>
      {issuesQuery.isLoading ? (
        <Typography>Loading…</Typography>
      ) : (
        <IssuesTable
          issues={issuesQuery.data ?? []}
          emptyText="No books are currently issued."
          actions={(i) => (
            <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
              <Button
                size="small"
                onClick={() => {
                  setReturning(i);
                  setDlgCondition("good");
                  setDlgExtra("");
                  setDlgDate("");
                }}
              >
                Return
              </Button>
              <Button size="small" disabled={i.is_overdue || renew.isPending} onClick={() => renew.mutate(i.id)}>
                Renew
              </Button>
            </Stack>
          )}
        />
      )}

      <Dialog open={!!returning} onClose={() => setReturning(null)} fullWidth maxWidth="xs">
        <DialogTitle>Return “{returning?.book_title}”</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Borrowed by {returning?.member_name}, due {returning?.due_date}.
              {returning?.is_overdue && ` ${returning.days_overdue} days late — fine so far ${formatMoney(returning.fine_amount)}.`}
            </Typography>
            <TextField select label="Condition" value={dlgCondition} onChange={(e) => setDlgCondition(e.target.value as Condition)}>
              <MenuItem value="good">Good</MenuItem>
              <MenuItem value="damaged">Damaged</MenuItem>
              <MenuItem value="lost">Lost</MenuItem>
            </TextField>
            <TextField
              label="Return date"
              type="date"
              value={dlgDate}
              onChange={(e) => setDlgDate(e.target.value)}
              helperText="Leave blank for today"
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField label="Extra charge" type="number" value={dlgExtra} onChange={(e) => setDlgExtra(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReturning(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={returnIssue.isPending}
            onClick={() =>
              returning &&
              returnIssue.mutate({
                id: returning.id,
                payload: {
                  condition: dlgCondition,
                  returned_on: dlgDate || undefined,
                  extra_fine: dlgExtra ? Number(dlgExtra) : 0,
                },
              })
            }
          >
            Confirm return
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

interface PersonOption {
  id: string;
  label: string;
  sub: string | null;
}

function MembersPanel() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<MemberType | "all">("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const membersQuery = useQuery({
    queryKey: ["library", "members", typeFilter, search],
    queryFn: () => listLibraryMembers({ memberType: typeFilter, q: search || undefined }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["library"] });

  const toggle = useMutation({
    mutationFn: (m: LibraryMember) => setLibraryMemberStatus(m.id, m.status === "active" ? "inactive" : "active"),
    onSuccess: refresh,
  });

  async function openCard(id: string) {
    try {
      const blob = await downloadLibraryCard(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(libraryErrorMessage(err, "Could not generate the library card."));
    }
  }

  // Add member dialog
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState<MemberType>("student");
  const [person, setPerson] = useState<PersonOption | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const peopleQuery = useQuery({
    queryKey: ["library", "people", newType],
    enabled: open,
    queryFn: async (): Promise<PersonOption[]> => {
      if (newType === "student") {
        const rows = await listStudents({ status: "active" });
        return rows.map((s) => ({ id: s.id, label: s.full_name, sub: s.admission_number ?? s.roll_number }));
      }
      if (newType === "teacher") {
        const rows = await listTeachers();
        return rows.map((t) => ({ id: t.id, label: t.full_name, sub: t.employee_code }));
      }
      const rows = await listStaff({ status: "active" });
      return rows.map((s) => ({ id: s.id, label: s.full_name, sub: `${s.designation} · ${s.employee_code}` }));
    },
  });
  const addMember = useMutation({
    mutationFn: () =>
      createLibraryMember({
        member_type: newType,
        student_id: newType === "student" ? person!.id : undefined,
        teacher_id: newType === "teacher" ? person!.id : undefined,
        staff_id: newType === "staff" ? person!.id : undefined,
      }),
    onSuccess: () => {
      setPerson(null);
      setDialogError(null);
      setOpen(false);
      refresh();
    },
    onError: (err) => setDialogError(libraryErrorMessage(err, "Could not register member.")),
  });

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Search name, card, admission no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 300, maxWidth: "100%" }}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            }}
          />
          <TextField
            select
            size="small"
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MemberType | "all")}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="student">Students</MenuItem>
            <MenuItem value="teacher">Teachers</MenuItem>
            <MenuItem value="staff">Staff</MenuItem>
          </TextField>
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Register member
          </Button>
        </Stack>
      </Paper>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {membersQuery.data?.length === 0 && (
        <Alert severity="info">No library members yet. Students and teachers also become members automatically when they reserve a book.</Alert>
      )}
      {!!membersQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Card no.</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Books out</TableCell>
                <TableCell>Outstanding fine</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {membersQuery.data.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell>{m.card_number}</TableCell>
                  <TableCell>{m.full_name}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{m.member_type}</TableCell>
                  <TableCell>{m.reference ?? "—"}</TableCell>
                  <TableCell>{m.active_issues}</TableCell>
                  <TableCell sx={{ color: m.outstanding_fine > 0 ? "error.main" : undefined }}>
                    {formatMoney(m.outstanding_fine)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={m.status} color={m.status === "active" ? "success" : "default"} />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" onClick={() => openCard(m.id)}>
                      Card
                    </Button>
                    <Button size="small" color={m.status === "active" ? "error" : "primary"} onClick={() => toggle.mutate(m)}>
                      {m.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Register library member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Member type"
              value={newType}
              onChange={(e) => {
                setNewType(e.target.value as MemberType);
                setPerson(null);
              }}
            >
              <MenuItem value="student">Student</MenuItem>
              <MenuItem value="teacher">Teacher</MenuItem>
              <MenuItem value="staff">Staff</MenuItem>
            </TextField>
            <Autocomplete
              options={peopleQuery.data ?? []}
              loading={peopleQuery.isLoading}
              value={person}
              onChange={(_, v) => setPerson(v)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              getOptionLabel={(p) => (p.sub ? `${p.label} (${p.sub})` : p.label)}
              renderInput={(params) => <TextField {...params} label="Person" required />}
            />
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!person || addMember.isPending} onClick={() => addMember.mutate()}>
            Register
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
