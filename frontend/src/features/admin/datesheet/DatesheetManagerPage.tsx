import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listExams, getDatesheet, downloadDatesheetPdf, type Exam } from "../../../api/exams";
import { listClasses } from "../../../api/classes";
import type { ClassGrade } from "../../../api/classes";

function statusColor(status: string) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "default" as const;
}

export function DatesheetManagerPage() {
  const navigate = useNavigate();
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const exams = useQuery<Exam[]>({ queryKey: ["exams"], queryFn: listExams });
  const classes = useQuery<ClassGrade[]>({ queryKey: ["classes"], queryFn: listClasses });

  const datesheet = useQuery({
    queryKey: ["datesheet", selectedExam, selectedClass],
    queryFn: () =>
      getDatesheet(selectedExam, {
        class_grade_id: selectedClass || undefined,
      }),
    enabled: !!selectedExam,
  });

  const examObj = (exams.data || []).find((e) => e.id === selectedExam);
  const entries = datesheet.data || [];

  function handleDownloadPdf() {
    downloadDatesheetPdf(selectedExam, {
      class_grade_id: selectedClass || undefined,
    });
  }

  return (
    <AppShell navItems={adminNavItems} title="Date Sheet">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <CalendarMonthIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Date Sheet
          </Typography>
        </Stack>

        {/* Selector row */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-end">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Select Exam</InputLabel>
            <Select
              value={selectedExam}
              label="Select Exam"
              onChange={(e) => { setSelectedExam(e.target.value); setSelectedClass(""); }}
            >
              {(exams.data || []).map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name} — {e.academic_year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Class (optional)</InputLabel>
            <Select
              value={selectedClass}
              label="Class (optional)"
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <MenuItem value="">All Classes</MenuItem>
              {(classes.data || []).map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedExam && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PictureAsPdfIcon />}
                onClick={handleDownloadPdf}
                disabled={entries.length === 0}
              >
                Download PDF
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/admin/exams/${selectedExam}?tab=datesheet`)}
              >
                Edit Date Sheet
              </Button>
            </>
          )}
        </Stack>

        {/* Exam info banner */}
        {examObj && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                {examObj.name}
              </Typography>
              <Chip size="small" label={examObj.status} color={statusColor(examObj.status)} />
              <Typography variant="body2" color="text.secondary">
                {examObj.academic_year}
              </Typography>
              {examObj.result_published && (
                <Chip size="small" label="Results Published" color="info" />
              )}
            </Stack>
          </Paper>
        )}

        {/* Date sheet table */}
        {selectedExam && (
          <Paper variant="outlined">
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {entries.length > 0
                  ? `${entries.length} paper(s) scheduled`
                  : datesheet.isLoading
                  ? "Loading…"
                  : "No date sheet entries yet. Click \"Edit Date Sheet\" to create one."}
              </Typography>
            </Box>
            {entries.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Day</TableCell>
                      <TableCell>Subject</TableCell>
                      <TableCell>Class</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>End</TableCell>
                      <TableCell>Total Marks</TableCell>
                      <TableCell>Pass Marks</TableCell>
                      <TableCell>Room</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entries.map((e, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{e.exam_date || "—"}</TableCell>
                        <TableCell>
                          {e.exam_date
                            ? new Date(e.exam_date).toLocaleDateString("en-US", { weekday: "short" })
                            : "—"}
                        </TableCell>
                        <TableCell>{e.subject_name}</TableCell>
                        <TableCell>{e.class_name}</TableCell>
                        <TableCell>{e.start_time || "—"}</TableCell>
                        <TableCell>{e.end_time || "—"}</TableCell>
                        <TableCell>{e.total_marks}</TableCell>
                        <TableCell>{e.passing_marks}</TableCell>
                        <TableCell>{e.room || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {/* All exams overview if none selected */}
        {!selectedExam && (
          <Paper variant="outlined">
            <TableContainer>
              <Table size="small">
                <TableHead sx={darkTableHeadSx}>
                  <TableRow>
                    <TableCell>Exam Name</TableCell>
                    <TableCell>Academic Year</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Results</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(exams.data || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No exams found. Create one in Examination → Exams.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (exams.data || []).map((exam) => (
                      <TableRow key={exam.id} hover>
                        <TableCell>{exam.name}</TableCell>
                        <TableCell>{exam.academic_year}</TableCell>
                        <TableCell>
                          <Chip size="small" label={exam.status} color={statusColor(exam.status)} />
                        </TableCell>
                        <TableCell>
                          {exam.result_published ? (
                            <Chip size="small" label="Published" color="info" />
                          ) : (
                            <Typography variant="body2" color="text.secondary">Not published</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View date sheet">
                            <IconButton
                              size="small"
                              onClick={() => setSelectedExam(exam.id)}
                            >
                              <CalendarMonthIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit date sheet">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/exams/${exam.id}?tab=datesheet`)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Stack>
    </AppShell>
  );
}
