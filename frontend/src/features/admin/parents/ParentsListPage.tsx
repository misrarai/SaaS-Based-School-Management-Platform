import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  InputAdornment,
  Paper,
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
import SearchIcon from "@mui/icons-material/SearchOutlined";
import SendIcon from "@mui/icons-material/SendOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import PeopleIcon from "@mui/icons-material/PeopleOutlined";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listStudents, type Student } from "../../../api/students";

function getGuardianPhone(s: Student) {
  return (s.admission_detail as any)?.contact_phone
    || (s.admission_detail as any)?.guardian_phone
    || null;
}

function makeWhatsAppLink(phone: string) {
  const clean = phone.replace(/[^0-9+]/g, "");
  return `https://wa.me/${clean}`;
}

export function ParentsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const students = useQuery({
    queryKey: ["students", "active"],
    queryFn: () => listStudents({ status: "active" }),
  });

  const q = search.toLowerCase();
  const list = (students.data ?? []).filter(
    (s) =>
      s.full_name.toLowerCase().includes(q) ||
      (s.guardian_name || "").toLowerCase().includes(q) ||
      (s.class_grade || "").toLowerCase().includes(q)
  );

  return (
    <AppShell navItems={adminNavItems} title="Parents">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <PeopleIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>
              Parents / Guardians
            </Typography>
          </Stack>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => navigate("/admin/parents/message")}
          >
            Send Message
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          List of all student guardians. Click "Message" to send them an update or
          progress report.
        </Typography>

        <TextField
          size="small"
          placeholder="Search by student name, guardian, class…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 400 }}
        />

        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Guardian Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      {students.isLoading ? "Loading…" : "No students found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((s) => {
                    const phone = getGuardianPhone(s);
                    return (
                      <TableRow key={s.id} hover>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: "primary.light" }}>
                              {s.full_name[0]}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {s.full_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {s.admission_number || s.email}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{(s as any).class_grade || "—"}</TableCell>
                        <TableCell>{s.guardian_name || "—"}</TableCell>
                        <TableCell>
                          {phone ? (
                            <Typography variant="body2">{phone}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.disabled">Not saved</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={s.status}
                            color={s.status === "active" ? "success" : "default"}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" justifyContent="center" spacing={1}>
                            <Tooltip title="Send Email / Progress Report">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<SendIcon />}
                                onClick={() =>
                                  navigate(`/admin/parents/message?student=${s.id}`)
                                }
                              >
                                Message
                              </Button>
                            </Tooltip>
                            {phone && (
                              <Tooltip title="Open WhatsApp">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<WhatsAppIcon />}
                                  href={makeWhatsAppLink(phone)}
                                  target="_blank"
                                  sx={{
                                    color: "#25D366",
                                    borderColor: "#25D366",
                                    "&:hover": { borderColor: "#1ebe57", bgcolor: "#f0fff4" },
                                  }}
                                >
                                  WhatsApp
                                </Button>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </AppShell>
  );
}
