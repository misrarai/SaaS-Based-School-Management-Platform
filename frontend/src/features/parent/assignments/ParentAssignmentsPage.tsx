import { useState } from "react";
import {
  Alert,
  Box,
  Chip,
  FormControl,
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
  Typography,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listMyChildren } from "../../../api/parents";
import { getGradebook } from "../../../api/assignments";

export function ParentAssignmentsPage() {
  const childrenQuery = useQuery({ queryKey: ["parents", "me", "children"], queryFn: listMyChildren });
  const [studentId, setStudentId] = useState("");
  const effectiveId = studentId || childrenQuery.data?.[0]?.id || "";

  const gradebookQuery = useQuery({
    queryKey: ["gradebook", "parent", effectiveId],
    queryFn: () => getGradebook(effectiveId),
    enabled: !!effectiveId,
  });

  const children = childrenQuery.data ?? [];
  const subjects = gradebookQuery.data?.subjects ?? [];

  return (
    <AppShell navItems={parentNavItems} title="Assignments & Grades">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AssignmentIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Assignments & Grades</Typography>
            <Typography variant="body2" color="text.secondary">
              View your child's assignment grades by subject
            </Typography>
          </Box>
        </Stack>

        {children.length > 1 && (
          <FormControl size="small" sx={{ maxWidth: 240 }}>
            <InputLabel>Child</InputLabel>
            <Select value={studentId} label="Child" onChange={(e) => setStudentId(e.target.value)}>
              {children.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.full_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {children.length === 0 && (
          <Alert severity="info">No children linked to your account yet.</Alert>
        )}

        {effectiveId && subjects.length === 0 && !gradebookQuery.isLoading && (
          <Alert severity="info">No gradebook data available yet.</Alert>
        )}

        {subjects.map((subject: any) => (
          <Box key={subject.subject_id}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              {subject.subject_name}
              {subject.average_percent !== undefined && (
                <Chip
                  size="small"
                  label={`Avg: ${subject.average_percent}%`}
                  color={subject.average_percent >= 70 ? "success" : subject.average_percent >= 50 ? "warning" : "error"}
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            {subject.assignments?.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
                <Table size="small">
                  <TableHead sx={darkTableHeadSx}>
                    <TableRow>
                      <TableCell>Assignment</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell align="right">Marks</TableCell>
                      <TableCell align="right">%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subject.assignments.map((a: any) => (
                      <TableRow key={a.id} hover>
                        <TableCell>{a.title}</TableCell>
                        <TableCell>
                          {a.due_date
                            ? new Date(a.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                            : "—"}
                        </TableCell>
                        <TableCell align="right">
                          {a.marks_obtained !== undefined && a.total_marks
                            ? `${a.marks_obtained} / ${a.total_marks}`
                            : "—"}
                        </TableCell>
                        <TableCell align="right">
                          {a.percent !== undefined ? (
                            <Chip
                              size="small"
                              label={`${a.percent}%`}
                              color={a.percent >= 70 ? "success" : a.percent >= 50 ? "warning" : "error"}
                            />
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No assignments yet for this subject.
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </AppShell>
  );
}
