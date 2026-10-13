import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/AddOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  listClasses,
  listSubjects,
  createSubject,
  deleteSubject,
  type ClassGrade,
  type Subject,
} from "../../../api/classes";

interface AddSubjectDialogProps {
  open: boolean;
  classGrade: ClassGrade | null;
  onClose: () => void;
}

function AddSubjectDialog({ open, classGrade, onClose }: AddSubjectDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: () => createSubject(classGrade!.id, { name: name.trim(), code: code.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects", classGrade!.id] });
      setName("");
      setCode("");
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Subject — {classGrade?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Subject Name"
            size="small"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Code (e.g. ENG, MTH)"
            size="small"
            fullWidth
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ClassSubjects({ classGrade }: { classGrade: ClassGrade }) {
  const qc = useQueryClient();
  const subjects = useQuery<Subject[]>({
    queryKey: ["subjects", classGrade.id],
    queryFn: () => listSubjects(classGrade.id),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects", classGrade.id] }),
  });

  const list = subjects.data || [];

  return (
    <>
      {list.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No subjects yet.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Subject Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell width={60} />
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={s.code} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete subject">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => del.mutate(s.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}

export function CurriculumPage() {
  const [addFor, setAddFor] = useState<ClassGrade | null>(null);

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: listClasses,
  });

  const sorted = [...(classes.data || [])].sort(
    (a, b) => a.level_order - b.level_order
  );

  return (
    <AppShell navItems={adminNavItems} title="Curriculum — Subjects">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <MenuBookIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Curriculum — Subjects
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Manage subjects assigned to each class. Subjects are used in timetables,
          marks entry, and date sheets.
        </Typography>

        {sorted.length === 0 && !classes.isLoading && (
          <Typography color="text.secondary">No classes found.</Typography>
        )}

        {sorted.map((cls) => (
          <Accordion key={cls.id} defaultExpanded={sorted.indexOf(cls) === 0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ width: "100%", pr: 1 }}
              >
                <Typography fontWeight={600}>{cls.name}</Typography>
                <Box onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setAddFor(cls)}
                  >
                    Add Subject
                  </Button>
                </Box>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <ClassSubjects classGrade={cls} />
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      <AddSubjectDialog
        open={!!addFor}
        classGrade={addFor}
        onClose={() => setAddFor(null)}
      />
    </AppShell>
  );
}
