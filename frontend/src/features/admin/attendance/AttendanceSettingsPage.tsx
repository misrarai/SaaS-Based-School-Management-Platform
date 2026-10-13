import { useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/AddOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EventIcon from "@mui/icons-material/EventOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  listHolidays,
  createHoliday,
  deleteHoliday,
  type Holiday,
  type HolidayType,
} from "../../../api/holidays";

const HOLIDAY_COLORS: Record<HolidayType, "default" | "primary" | "warning" | "info"> = {
  public: "primary",
  school: "info",
  exam: "warning",
  event: "default",
};

const CURRENT_YEAR = new Date().getFullYear();

function AddHolidayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [type, setType] = useState<HolidayType>("school");
  const [desc, setDesc] = useState("");

  const add = useMutation({
    mutationFn: () =>
      createHoliday({
        name: name.trim(),
        from_date: fromDate,
        to_date: toDate || fromDate,
        holiday_type: type,
        description: desc.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      setName(""); setFromDate(""); setToDate(""); setDesc("");
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Holiday</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Holiday Name"
            size="small"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={(e) => setType(e.target.value as HolidayType)}
            >
              <MenuItem value="public">Public Holiday</MenuItem>
              <MenuItem value="school">School Holiday</MenuItem>
              <MenuItem value="exam">Exam Break</MenuItem>
              <MenuItem value="event">School Event</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="From Date"
            type="date"
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <TextField
            label="To Date (leave blank for single day)"
            type="date"
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <TextField
            label="Description (optional)"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || !fromDate || add.isPending}
          onClick={() => add.mutate()}
        >
          Add Holiday
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AttendanceSettingsPage() {
  const [tab, setTab] = useState(0);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [addOpen, setAddOpen] = useState(false);
  const qc = useQueryClient();

  const holidays = useQuery<Holiday[]>({
    queryKey: ["holidays", year],
    queryFn: () => listHolidays(year),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteHoliday(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holidays"] }),
  });

  const list = holidays.data || [];
  const totalDays = list.reduce((sum, h) => sum + h.days, 0);

  return (
    <AppShell navItems={adminNavItems} title="Attendance Settings">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <EventIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Attendance Settings
          </Typography>
        </Stack>

        <Paper variant="outlined">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Holidays Calendar" />
            <Tab label="Leave Types" />
          </Tabs>

          {/* HOLIDAYS */}
          {tab === 0 && (
            <Stack spacing={2} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={2}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Year</InputLabel>
                    <Select
                      value={year}
                      label="Year"
                      onChange={(e) => setYear(Number(e.target.value))}
                    >
                      {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
                        <MenuItem key={y} value={y}>{y}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Chip label={`${totalDays} holiday days`} size="small" />
                </Stack>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setAddOpen(true)}
                >
                  Add Holiday
                </Button>
              </Stack>

              <TableContainer>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>Days</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell width={60} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No holidays for {year}
                        </TableCell>
                      </TableRow>
                    ) : (
                      list.map((h) => (
                        <TableRow key={h.id} hover>
                          <TableCell>{h.name}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={h.holiday_type}
                              color={HOLIDAY_COLORS[h.holiday_type]}
                            />
                          </TableCell>
                          <TableCell>{h.from_date}</TableCell>
                          <TableCell>{h.to_date}</TableCell>
                          <TableCell>{h.days}</TableCell>
                          <TableCell>{h.description || "—"}</TableCell>
                          <TableCell>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => del.mutate(h.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}

          {/* LEAVE TYPES */}
          {tab === 1 && (
            <Stack spacing={2} sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Leave types configuration (Sick Leave, Casual Leave, Annual Leave, etc.) is
                managed via the HR module. Student leave requests appear in the Attendance
                module under Student Leaves.
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Leave Type</TableCell>
                      <TableCell>For</TableCell>
                      <TableCell>Paid</TableCell>
                      <TableCell>Max Days/Year</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { name: "Sick Leave", for: "Staff / Teacher", paid: "Yes", max: "10" },
                      { name: "Casual Leave", for: "Staff / Teacher", paid: "Yes", max: "12" },
                      { name: "Annual Leave", for: "Staff / Teacher", paid: "Yes", max: "21" },
                      { name: "Unpaid Leave", for: "Staff / Teacher", paid: "No", max: "—" },
                      { name: "Student Absence", for: "Student", paid: "N/A", max: "—" },
                    ].map((lt) => (
                      <TableRow key={lt.name} hover>
                        <TableCell>{lt.name}</TableCell>
                        <TableCell>{lt.for}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={lt.paid}
                            color={lt.paid === "Yes" ? "success" : lt.paid === "No" ? "default" : "info"}
                          />
                        </TableCell>
                        <TableCell>{lt.max}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary">
                Full leave management configuration coming in the HR Settings module.
              </Typography>
            </Stack>
          )}
        </Paper>
      </Stack>

      <AddHolidayDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </AppShell>
  );
}
