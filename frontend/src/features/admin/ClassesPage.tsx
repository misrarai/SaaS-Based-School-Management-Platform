import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";
import {
  createClass,
  createSection,
  createSubject,
  listClasses,
  listSections,
  listSubjects,
  type ClassGrade,
} from "../../api/classes";

function ClassPanel({ classGrade }: { classGrade: ClassGrade }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  const sectionsQuery = useQuery({
    queryKey: ["sections", classGrade.id],
    queryFn: () => listSections(classGrade.id),
    enabled: expanded,
  });
  const subjectsQuery = useQuery({
    queryKey: ["subjects", classGrade.id],
    queryFn: () => listSubjects(classGrade.id),
    enabled: expanded,
  });

  const addSection = useMutation({
    mutationFn: () => createSection(classGrade.id, sectionName),
    onSuccess: () => {
      setSectionName("");
      queryClient.invalidateQueries({ queryKey: ["sections", classGrade.id] });
    },
  });

  const addSubject = useMutation({
    mutationFn: () => createSubject(classGrade.id, { name: subjectName, code: subjectCode }),
    onSuccess: () => {
      setSubjectName("");
      setSubjectCode("");
      queryClient.invalidateQueries({ queryKey: ["subjects", classGrade.id] });
    },
  });

  return (
    <Accordion expanded={expanded} onChange={(_, next) => setExpanded(next)} disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography sx={{ fontWeight: 600 }}>{classGrade.name}</Typography>
          <Chip size="small" label={classGrade.academic_year} variant="outlined" />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Sections
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
              {sectionsQuery.data?.length ? (
                sectionsQuery.data.map((s) => <Chip key={s.id} label={s.name} />)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No sections yet
                </Typography>
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                addSection.mutate();
              }}
            >
              <TextField
                size="small"
                placeholder="Section name (e.g. A)"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                required
              />
              <Button type="submit" variant="outlined" size="small" disabled={addSection.isPending}>
                Add section
              </Button>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Subjects
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
              {subjectsQuery.data?.length ? (
                subjectsQuery.data.map((s) => <Chip key={s.id} label={`${s.name} (${s.code})`} />)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No subjects yet
                </Typography>
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                addSubject.mutate();
              }}
            >
              <TextField
                size="small"
                placeholder="Subject name"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
              />
              <TextField
                size="small"
                placeholder="Code"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                required
                sx={{ width: 100 }}
              />
              <Button type="submit" variant="outlined" size="small" disabled={addSubject.isPending}>
                Add subject
              </Button>
            </Stack>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export function ClassesPage() {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [levelOrder, setLevelOrder] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [error, setError] = useState<string | null>(null);

  const addClass = useMutation({
    mutationFn: () => createClass({ name, level_order: Number(levelOrder), academic_year: academicYear }),
    onSuccess: () => {
      setName("");
      setLevelOrder("");
      setError(null);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: () => setError("Could not create class (it may already exist for that academic year)."),
  });

  return (
    <AppShell title="Classes, Sections & Subjects" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Classes</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add class
        </Button>
      </Stack>

      {classesQuery.isLoading && <Typography>Loading…</Typography>}
      {classesQuery.data?.length === 0 && (
        <Alert severity="info">No classes yet — click "Add class" to create your first one (e.g. Grade 1).</Alert>
      )}

      <Stack spacing={1.5}>
        {classesQuery.data?.map((c) => (
          <ClassPanel key={c.id} classGrade={c} />
        ))}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add a class</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            addClass.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Class name"
                placeholder="e.g. Grade 5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                fullWidth
              />
              <TextField
                label="Level order"
                helperText="1 = lowest (Primary), higher numbers for senior classes"
                type="number"
                value={levelOrder}
                onChange={(e) => setLevelOrder(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Academic year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                required
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addClass.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
