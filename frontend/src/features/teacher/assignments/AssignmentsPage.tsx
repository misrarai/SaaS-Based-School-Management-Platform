import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses, listSections, listSubjects } from "../../../api/classes";
import { createAssignment, listAssignments } from "../../../api/assignments";

function CreateAssignmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const sectionsQuery = useQuery({
    queryKey: ["sections", classGradeId],
    queryFn: () => listSections(classGradeId),
    enabled: !!classGradeId,
  });
  const subjectsQuery = useQuery({
    queryKey: ["subjects", classGradeId],
    queryFn: () => listSubjects(classGradeId),
    enabled: !!classGradeId,
  });
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createAssignment({
        section_id: sectionId,
        subject_id: subjectId,
        title,
        description: description || undefined,
        due_date: new Date(dueDate).toISOString(),
        max_marks: maxMarks ? Number(maxMarks) : undefined,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDueDate("");
      setMaxMarks("");
      setError(null);
      onClose();
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: () => setError("Could not create assignment — make sure you're scheduled to teach this class/subject."),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New assignment</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <FormControl fullWidth required>
              <InputLabel id="a-class-label">Class</InputLabel>
              <Select
                labelId="a-class-label"
                label="Class"
                value={classGradeId}
                onChange={(e) => {
                  setClassGradeId(e.target.value);
                  setSectionId("");
                  setSubjectId("");
                }}
              >
                {classesQuery.data?.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth required disabled={!classGradeId}>
                <InputLabel id="a-section-label">Section</InputLabel>
                <Select
                  labelId="a-section-label"
                  label="Section"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                >
                  {sectionsQuery.data?.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required disabled={!classGradeId}>
                <InputLabel id="a-subject-label">Subject</InputLabel>
                <Select
                  labelId="a-subject-label"
                  label="Subject"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  {subjectsQuery.data?.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Due date & time"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Max marks (optional)"
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                fullWidth
              />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={create.isPending}>
            Create
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function AssignmentsPage() {
  const navigate = useNavigate();
  const assignmentsQuery = useQuery({ queryKey: ["assignments", "teacher"], queryFn: () => listAssignments() });
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <AppShell title="Assignments" navItems={teacherNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Assignments</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          New assignment
        </Button>
      </Stack>

      {assignmentsQuery.data?.length === 0 && <Alert severity="info">No assignments created yet.</Alert>}

      {!!assignmentsQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>Max marks</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignmentsQuery.data.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>{new Date(a.due_date).toLocaleString()}</TableCell>
                  <TableCell>{a.max_marks ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => navigate(`/teacher/assignments/${a.id}/submissions`)}>
                      Review submissions
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateAssignmentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppShell>
  );
}
