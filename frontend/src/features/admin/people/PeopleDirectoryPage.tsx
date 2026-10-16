import { useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import SearchIcon from "@mui/icons-material/SearchOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listStudents } from "../../../api/students";
import { listTeachers } from "../../../api/teachers";
import { listStaff } from "../../../api/staff";

type TabKey = "students" | "teachers" | "staff";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function PeopleDirectoryPage() {
  const [tab, setTab] = useState<TabKey>("students");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const students = useQuery({
    queryKey: ["students", "all"],
    queryFn: () => listStudents({ status: "active" }),
  });
  const teachers = useQuery({
    queryKey: ["teachers", "all"],
    queryFn: () => listTeachers(),
  });
  const staffQ = useQuery({
    queryKey: ["staff", "all"],
    queryFn: () => listStaff({ status: "active" }),
  });

  const q = search.toLowerCase();

  const filteredStudents = (students.data || []).filter(
    (s) =>
      s.full_name.toLowerCase().includes(q) ||
      (s.admission_number || "").toLowerCase().includes(q) ||
      (s.class_grade || "").toLowerCase().includes(q)
  );

  const filteredTeachers = (teachers.data || []).filter(
    (t) =>
      t.full_name.toLowerCase().includes(q) ||
      (t.subject_specialization || "").toLowerCase().includes(q)
  );

  const filteredStaff = (staffQ.data || []).filter((s) => {
    const statusOk = statusFilter === "all" || s.status === statusFilter;
    return (
      statusOk &&
      (s.full_name.toLowerCase().includes(q) ||
        (s.designation || "").toLowerCase().includes(q))
    );
  });

  const counts = {
    students: students.data?.length ?? 0,
    teachers: teachers.data?.length ?? 0,
    staff: staffQ.data?.length ?? 0,
  };

  return (
    <AppShell navItems={adminNavItems} title="People Directory">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <PersonIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            People Directory
          </Typography>
        </Stack>

        {/* Search + filter row */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            size="small"
            placeholder="Search by name, ID, class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 280 }}
          />
          {tab === "staff" && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </Select>
            </FormControl>
          )}
        </Stack>

        <Paper variant="outlined">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label={`Students (${counts.students})`} value="students" />
            <Tab label={`Teachers (${counts.teachers})`} value="teachers" />
            <Tab label={`Staff (${counts.staff})`} value="staff" />
          </Tabs>

          <Box>
            {/* STUDENTS */}
            {tab === "students" && (
              <TableContainer>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Adm #</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Section</TableCell>
                      <TableCell>Father</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No students found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((s) => (
                        <TableRow key={s.id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                                {initials(s.full_name)}
                              </Avatar>
                              <Typography variant="body2">{s.full_name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{s.admission_number || "—"}</TableCell>
                          <TableCell>{s.class_grade || "—"}</TableCell>
                          <TableCell>{s.section || "—"}</TableCell>
                          <TableCell>{s.father_name || "—"}</TableCell>
                          <TableCell>{s.contact_phone || "—"}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={s.status}
                              color={s.status === "active" ? "success" : "default"}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* TEACHERS */}
            {tab === "teachers" && (
              <TableContainer>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Specialization</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTeachers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No teachers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTeachers.map((t) => (
                        <TableRow key={t.id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                                {initials(t.full_name)}
                              </Avatar>
                              <Typography variant="body2">{t.full_name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{t.subject_specialization || "—"}</TableCell>
                          <TableCell>{t.email || "—"}</TableCell>
                          <TableCell>{t.phone || "—"}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={t.is_active ? "Active" : "Inactive"}
                              color={t.is_active ? "success" : "default"}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* STAFF */}
            {tab === "staff" && (
              <TableContainer>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Employee Code</TableCell>
                      <TableCell>Designation</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Hire Date</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No staff found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaff.map((s) => (
                        <TableRow key={s.id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                                {initials(s.full_name)}
                              </Avatar>
                              <Typography variant="body2">{s.full_name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{s.employee_code}</TableCell>
                          <TableCell>{s.designation}</TableCell>
                          <TableCell>{s.phone || "—"}</TableCell>
                          <TableCell>{s.hire_date || "—"}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={s.status}
                              color={s.status === "active" ? "success" : "default"}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      </Stack>
    </AppShell>
  );
}
