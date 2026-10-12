import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import ClassIcon from "@mui/icons-material/ClassOutlined";
import ViewModuleIcon from "@mui/icons-material/ViewModuleOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import GroupsIcon from "@mui/icons-material/GroupsOutlined";
import PersonOffIcon from "@mui/icons-material/PersonOffOutlined";
import { AppShell } from "../../components/AppShell";
import { darkTableHeadSx } from "../../components/tableStyles";
import { adminNavItems } from "./adminNav";
import {
  createClass,
  createSection,
  createSubject,
  deleteClass,
  deleteSection,
  deleteSubject,
  getClassesOverview,
  updateClass,
  updateSection,
  updateSubject,
  type ClassOverview,
  type SectionOverview,
  type Subject,
} from "../../api/classes";
import { createAcademicYear, listAcademicYears, type AcademicYear } from "../../api/academicYears";
import { listTeachers, type Teacher } from "../../api/teachers";
import { apiErrorMessage } from "../../lib/apiError";
import { GRADE_BAND_LABELS, gradeBand, type GradeBand } from "../../lib/gradeBands";
import { tileColors } from "../../theme";
import { ConfirmDeleteDialog, PageHeader, StatCard } from "./academics/academicsUi";
import { BAND_COLORS, initials } from "./academics/academicsUtils";

const ALL = "all";

type DeleteTarget =
  | { kind: "class"; id: string; label: string }
  | { kind: "section"; id: string; label: string }
  | { kind: "subject"; id: string; label: string };

function yearMatches(c: ClassOverview, year: AcademicYear | undefined) {
  if (!year) return true;
  return c.academic_year_id === year.id || (!c.academic_year_id && c.academic_year === year.name);
}

// --- Dialogs --------------------------------------------------------------------------

/** Session the school is in today, assuming an April–March year ("2026-2027" in Oct 2026). */
function suggestedYearName(today = new Date()) {
  const start = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

/** Dates for a typed session name: "2026-2027" / "2026-27" → 1 Apr 2026 – 31 Mar 2027,
 * a single year "2026" → that calendar year. */
function datesForYearName(name: string): { start_date: string; end_date: string } | null {
  const range = name.match(/^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
  if (range) {
    const start = Number(range[1]);
    return { start_date: `${start}-04-01`, end_date: `${start + 1}-03-31` };
  }
  const single = name.match(/^(\d{4})$/);
  if (single) return { start_date: `${single[1]}-01-01`, end_date: `${single[1]}-12-31` };
  return null;
}

function ClassDialog({
  open,
  editing,
  years,
  defaultYearId,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: ClassOverview | null;
  years: AcademicYear[];
  defaultYearId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [levelOrder, setLevelOrder] = useState(editing ? String(editing.level_order) : "");
  const initialYear =
    years.find((y) => y.id === (editing?.academic_year_id ?? defaultYearId))?.name ??
    editing?.academic_year ??
    (years.length === 0 ? suggestedYearName() : "");
  const [yearText, setYearText] = useState(initialYear);
  const [error, setError] = useState<string | null>(null);

  const typedYear = yearText.trim();
  const existingYear = years.find((y) => y.name.toLowerCase() === typedYear.toLowerCase());
  const yearIsNew = !!typedYear && !existingYear;
  const newYearDates = yearIsNew ? datesForYearName(typedYear) : null;

  const save = useMutation({
    mutationFn: async () => {
      let yearId = existingYear?.id;
      if (!yearId) {
        if (!newYearDates) throw new Error("Use a session like 2026-2027.");
        const created = await createAcademicYear({
          name: typedYear,
          ...newYearDates,
          is_active: !years.some((y) => y.is_active),
        });
        yearId = created.id;
      }
      const payload = { name: name.trim(), level_order: Number(levelOrder), academic_year_id: yearId };
      return editing ? updateClass(editing.id, payload) : createClass(payload);
    },
    onSuccess: () => onSaved(editing ? "Class updated" : "Class created"),
    onError: (err) =>
      setError(err instanceof Error && !("isAxiosError" in err) ? err.message : apiErrorMessage(err, "Could not save the class.")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a class"}</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
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
              helperText="Used for sorting and promotion — Grade 5 → 5. Promotion moves students to level + 1."
              type="number"
              value={levelOrder}
              onChange={(e) => setLevelOrder(e.target.value)}
              required
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <Autocomplete
              freeSolo
              options={years.map((y) => y.name)}
              inputValue={yearText}
              onInputChange={(_, v) => setYearText(v)}
              renderOption={(props, option) => {
                const { key, ...rest } = props;
                const y = years.find((x) => x.name === option);
                return (
                  <li key={key} {...rest}>
                    {option}
                    {y?.is_active && <Chip size="small" label="current" color="success" sx={{ ml: 1, height: 20 }} />}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Academic year (session)"
                  placeholder="e.g. 2026-2027"
                  required
                  error={yearIsNew && !newYearDates}
                  helperText={
                    yearIsNew
                      ? newYearDates
                        ? `New session — will be created (${newYearDates.start_date} to ${newYearDates.end_date}).`
                        : "Type a session like 2026-2027."
                      : "Pick a session or type a new one."
                  }
                />
              )}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending || !typedYear || (yearIsNew && !newYearDates)}>
            {editing ? "Save changes" : "Create class"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function SectionDialog({
  open,
  classGrade,
  editing,
  teachers,
  onClose,
  onSaved,
}: {
  open: boolean;
  classGrade: ClassOverview | null;
  editing: SectionOverview | null;
  teachers: Teacher[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [teacherId, setTeacherId] = useState(editing?.class_teacher_id ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      if (editing) return updateSection(editing.id, { name: name.trim(), class_teacher_id: teacherId || null });
      return createSection(classGrade!.id, name.trim(), teacherId || null);
    },
    onSuccess: () => onSaved(editing ? "Section updated" : "Section added"),
    onError: (err) => setError(apiErrorMessage(err, "Could not save the section.")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {editing ? `Edit section ${editing.name}` : "Add section"}
        {classGrade && (
          <Typography variant="body2" color="text.secondary">
            {classGrade.name} · {classGrade.academic_year}
          </Typography>
        )}
      </DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField
              label="Section name"
              placeholder="e.g. A, Blue, Morning"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              fullWidth
            />
            <TextField
              select
              label="Class teacher (in-charge)"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              fullWidth
              helperText="Optional — the teacher responsible for this section."
            >
              <MenuItem value="">
                <em>Not assigned</em>
              </MenuItem>
              {teachers
                .filter((t) => t.is_active || t.id === teacherId)
                .map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.full_name}
                    {t.employee_code ? ` · ${t.employee_code}` : ""}
                  </MenuItem>
                ))}
            </TextField>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            {editing ? "Save changes" : "Add section"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function SubjectDialog({
  open,
  classes,
  editing,
  defaultClassId,
  onClose,
  onSaved,
}: {
  open: boolean;
  classes: ClassOverview[];
  editing: Subject | null;
  defaultClassId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [classId, setClassId] = useState(editing?.class_grade_id ?? defaultClassId);
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      editing
        ? updateSubject(editing.id, { name: name.trim(), code: code.trim() })
        : createSubject(classId, { name: name.trim(), code: code.trim() }),
    onSuccess: () => onSaved(editing ? "Subject updated" : "Subject added"),
    onError: (err) => setError(apiErrorMessage(err, "Could not save the subject.")),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{editing ? "Edit subject" : "Add subject"}</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField
              select
              label="Class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              required
              fullWidth
              disabled={!!editing}
            >
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} · {c.academic_year}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Subject name"
                placeholder="e.g. Mathematics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                fullWidth
              />
              <TextField
                label="Code"
                placeholder="MATH5"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                sx={{ width: 130, flexShrink: 0 }}
              />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending || !classId}>
            {editing ? "Save changes" : "Add subject"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// --- Class card -----------------------------------------------------------------------

function SectionRow({
  section,
  onEdit,
  onDelete,
}: {
  section: SectionOverview;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: "center",
        px: 1.5,
        py: 1,
        borderRadius: 2,
        "&:hover": { bgcolor: "action.hover" },
        "&:hover .row-actions": { opacity: 1 },
      }}
    >
      <Box
        sx={{
          minWidth: 34,
          height: 34,
          px: 0.75,
          borderRadius: 1.5,
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          fontSize: 13,
          bgcolor: "primary.main",
          color: "#fff",
        }}
      >
        {section.name.length <= 3 ? section.name : section.name.slice(0, 2)}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          Section {section.name}
        </Typography>
        {section.class_teacher_name ? (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <Avatar sx={{ width: 18, height: 18, fontSize: 9, bgcolor: tileColors.teal }}>
              {initials(section.class_teacher_name)}
            </Avatar>
            <Typography variant="caption" color="text.secondary" noWrap>
              {section.class_teacher_name}
            </Typography>
          </Stack>
        ) : (
          <Typography
            variant="caption"
            onClick={onEdit}
            sx={{ color: tileColors.orange, cursor: "pointer", fontWeight: 500, "&:hover": { textDecoration: "underline" } }}
          >
            + Assign class teacher
          </Typography>
        )}
      </Box>
      <Tooltip title="Active students">
        <Chip
          size="small"
          icon={<GroupsIcon sx={{ fontSize: 16 }} />}
          label={section.student_count}
          variant="outlined"
          sx={{ fontVariantNumeric: "tabular-nums" }}
        />
      </Tooltip>
      <Stack direction="row" className="row-actions" sx={{ opacity: { xs: 1, md: 0 }, transition: "opacity .15s" }}>
        <Tooltip title="Edit section">
          <IconButton size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete section">
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

function ClassCard({
  classGrade,
  onEdit,
  onDelete,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onAddSubject,
}: {
  classGrade: ClassOverview;
  onEdit: () => void;
  onDelete: () => void;
  onAddSection: () => void;
  onEditSection: (s: SectionOverview) => void;
  onDeleteSection: (s: SectionOverview) => void;
  onAddSubject: () => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const band = gradeBand(classGrade.level_order);
  const color = BAND_COLORS[band];
  const shownSubjects = classGrade.subjects.slice(0, 5);
  const moreSubjects = classGrade.subjects.length - shownSubjects.length;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        "&::before": { content: '""', position: "absolute", inset: "0 0 auto 0", height: 4, bgcolor: color },
        transition: "box-shadow .2s",
        "&:hover": { boxShadow: "0 10px 30px rgba(15, 40, 70, .08)" },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ p: 2, pb: 1.5, alignItems: "center" }}>
        <Avatar
          variant="rounded"
          sx={{ bgcolor: `${color}1a`, color, fontWeight: 800, width: 46, height: 46, borderRadius: 2.5 }}
        >
          {classGrade.level_order}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
            {classGrade.name}
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: "wrap", rowGap: 0.5 }}>
            <Chip size="small" label={classGrade.academic_year} sx={{ height: 20, fontSize: 11 }} />
            <Chip
              size="small"
              label={GRADE_BAND_LABELS[band].split(" ")[0]}
              sx={{ height: 20, fontSize: 11, bgcolor: `${color}1a`, color, fontWeight: 600 }}
            />
          </Stack>
        </Box>
        <Box sx={{ textAlign: "right", px: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
            {classGrade.student_count}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            students
          </Typography>
        </Box>
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="Class actions">
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {[
            { label: "Edit class", icon: <EditIcon fontSize="small" />, run: onEdit },
            { label: "Add section", icon: <AddIcon fontSize="small" />, run: onAddSection },
            { label: "Add subject", icon: <MenuBookIcon fontSize="small" />, run: onAddSubject },
          ].map((item) => (
            <MenuItem
              key={item.label}
              onClick={() => {
                setMenuAnchor(null);
                item.run();
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          ))}
          <Divider />
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDelete();
            }}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete class</ListItemText>
          </MenuItem>
        </Menu>
      </Stack>

      <Divider />

      <Box sx={{ px: 0.5, py: 1, flex: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, fontWeight: 600 }}>
          Sections ({classGrade.sections.length})
        </Typography>
        {classGrade.sections.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
            No sections yet.
          </Typography>
        ) : (
          classGrade.sections.map((s) => (
            <SectionRow key={s.id} section={s} onEdit={() => onEditSection(s)} onDelete={() => onDeleteSection(s)} />
          ))
        )}
        <Button size="small" startIcon={<AddIcon />} onClick={onAddSection} sx={{ ml: 1, mt: 0.5 }}>
          Add section
        </Button>
      </Box>

      <Box sx={{ px: 2, py: 1.5, bgcolor: "background.default", borderTop: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
          <MenuBookIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          {classGrade.subjects.length === 0 ? (
            <Typography
              variant="caption"
              onClick={onAddSubject}
              sx={{ color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
            >
              No subjects — add one
            </Typography>
          ) : (
            <>
              {shownSubjects.map((s) => (
                <Chip key={s.id} size="small" label={s.name} variant="outlined" sx={{ height: 22, fontSize: 11.5, bgcolor: "background.paper" }} />
              ))}
              {moreSubjects > 0 && <Chip size="small" label={`+${moreSubjects}`} sx={{ height: 22, fontSize: 11.5 }} />}
            </>
          )}
        </Stack>
      </Box>
    </Card>
  );
}

// --- Page -----------------------------------------------------------------------------

export function ClassesPage() {
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({ queryKey: ["classes-overview"], queryFn: getClassesOverview });
  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const teachersQuery = useQuery({ queryKey: ["teachers", "class-teacher-picker"], queryFn: () => listTeachers() });

  const years = yearsQuery.data ?? [];
  const activeYear = years.find((y) => y.is_active);
  const [yearFilter, setYearFilter] = useState<string | null>(null); // null = "current year once loaded"
  const effectiveYearId = yearFilter ?? activeYear?.id ?? ALL;
  const selectedYear = years.find((y) => y.id === effectiveYearId);

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [band, setBand] = useState<GradeBand | typeof ALL>(ALL);
  const [subjectClassFilter, setSubjectClassFilter] = useState(ALL);

  const [classDialog, setClassDialog] = useState<{ editing: ClassOverview | null } | null>(null);
  const [sectionDialog, setSectionDialog] = useState<{ classGrade: ClassOverview; editing: SectionOverview | null } | null>(null);
  const [subjectDialog, setSubjectDialog] = useState<{ editing: Subject | null; classId: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = () => {
    for (const key of ["classes-overview", "classes", "sections", "subjects", "academic-years"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const saved = (msg: string) => {
    setClassDialog(null);
    setSectionDialog(null);
    setSubjectDialog(null);
    setToast(msg);
    refresh();
  };

  const remove = useMutation({
    mutationFn: (t: DeleteTarget) =>
      t.kind === "class" ? deleteClass(t.id) : t.kind === "section" ? deleteSection(t.id) : deleteSubject(t.id),
    onSuccess: (_, t) => {
      setDeleteTarget(null);
      setToast(`${t.label} deleted`);
      refresh();
    },
    onError: (err) => setDeleteError(apiErrorMessage(err, "Could not delete.")),
  });

  const yearClasses = useMemo(
    () => (overviewQuery.data ?? []).filter((c) => effectiveYearId === ALL || yearMatches(c, selectedYear)),
    [overviewQuery.data, effectiveYearId, selectedYear],
  );

  const visibleClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return yearClasses.filter((c) => {
      if (band !== ALL && gradeBand(c.level_order) !== band) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.sections.some((s) => s.name.toLowerCase().includes(q) || s.class_teacher_name?.toLowerCase().includes(q)) ||
        c.subjects.some((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      );
    });
  }, [yearClasses, search, band]);

  const subjectRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return yearClasses
      .filter((c) => subjectClassFilter === ALL || c.id === subjectClassFilter)
      .flatMap((c) => c.subjects.map((s) => ({ subject: s, classGrade: c })))
      .filter(({ subject, classGrade }) =>
        !q ? true : [subject.name, subject.code, classGrade.name].some((v) => v.toLowerCase().includes(q)),
      );
  }, [yearClasses, subjectClassFilter, search]);

  const stats = useMemo(() => {
    const sections = yearClasses.flatMap((c) => c.sections);
    return {
      classes: yearClasses.length,
      sections: sections.length,
      subjects: yearClasses.reduce((n, c) => n + c.subjects.length, 0),
      students: yearClasses.reduce((n, c) => n + c.student_count, 0),
      unassigned: sections.filter((s) => !s.class_teacher_id).length,
    };
  }, [yearClasses]);

  const loading = overviewQuery.isLoading || yearsQuery.isLoading;

  return (
    <AppShell title="Classes, Sections & Subjects" navItems={adminNavItems}>
      <PageHeader
        title="Classes, Sections & Subjects"
        subtitle="Manage your school's academic structure, section in-charges and subject catalogue."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<MenuBookIcon />}
              onClick={() => setSubjectDialog({ editing: null, classId: subjectClassFilter !== ALL ? subjectClassFilter : "" })}
              disabled={yearClasses.length === 0}
            >
              Add subject
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setClassDialog({ editing: null })}>
              Add class
            </Button>
          </>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 4, lg: "grow" }}>
          <StatCard icon={<ClassIcon />} label="Classes" value={stats.classes} color={tileColors.blue} />
        </Grid>
        <Grid size={{ xs: 6, md: 4, lg: "grow" }}>
          <StatCard icon={<ViewModuleIcon />} label="Sections" value={stats.sections} color={tileColors.purple} />
        </Grid>
        <Grid size={{ xs: 6, md: 4, lg: "grow" }}>
          <StatCard icon={<MenuBookIcon />} label="Subjects" value={stats.subjects} color={tileColors.teal} />
        </Grid>
        <Grid size={{ xs: 6, md: 6, lg: "grow" }}>
          <StatCard icon={<GroupsIcon />} label="Active students" value={stats.students} color={tileColors.green} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: "grow" }}>
          <StatCard
            icon={<PersonOffIcon />}
            label="No class teacher"
            value={stats.unassigned}
            color={stats.unassigned ? tileColors.orange : tileColors.green}
            hint={stats.unassigned ? "Needs attention" : stats.sections ? "All assigned" : undefined}
          />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={`Classes & Sections (${visibleClasses.length})`} sx={{ fontWeight: 600 }} />
            <Tab label={`Subjects (${subjectRows.length})`} sx={{ fontWeight: 600 }} />
          </Tabs>
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{ p: 2, alignItems: { md: "center" }, bgcolor: "background.default" }}
        >
          <TextField
            size="small"
            placeholder={tab === 0 ? "Search class, section or teacher…" : "Search subject, code or class…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 220, bgcolor: "background.paper" }}
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
          <TextField
            select
            size="small"
            label="Academic year"
            value={effectiveYearId}
            onChange={(e) => setYearFilter(e.target.value)}
            sx={{ minWidth: 180, bgcolor: "background.paper" }}
          >
            <MenuItem value={ALL}>All years</MenuItem>
            {years.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.name}
                {y.is_active ? " (current)" : ""}
              </MenuItem>
            ))}
          </TextField>
          {tab === 0 ? (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={band}
              onChange={(_, v) => v && setBand(v)}
              sx={{ bgcolor: "background.paper" }}
            >
              <ToggleButton value={ALL}>All</ToggleButton>
              <ToggleButton value="primary">Primary</ToggleButton>
              <ToggleButton value="middle">Middle</ToggleButton>
              <ToggleButton value="secondary">Secondary</ToggleButton>
            </ToggleButtonGroup>
          ) : (
            <TextField
              select
              size="small"
              label="Class"
              value={subjectClassFilter}
              onChange={(e) => setSubjectClassFilter(e.target.value)}
              sx={{ minWidth: 180, bgcolor: "background.paper" }}
            >
              <MenuItem value={ALL}>All classes</MenuItem>
              {yearClasses.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>

        {loading && <LinearProgress />}
        {overviewQuery.isError && (
          <Alert severity="error" sx={{ m: 2 }}>
            {apiErrorMessage(overviewQuery.error, "Could not load classes.")}
          </Alert>
        )}

        {tab === 0 && !loading && (
          <Box sx={{ p: 2 }}>
            {yearClasses.length === 0 ? (
              <EmptyState
                title={selectedYear ? `No classes in ${selectedYear.name} yet` : "No classes yet"}
                body="Create your first class (e.g. Grade 1), then add its sections and subjects."
                action={
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setClassDialog({ editing: null })}>
                    Add class
                  </Button>
                }
              />
            ) : visibleClasses.length === 0 ? (
              <EmptyState title="No matches" body="Try a different search or filter." />
            ) : (
              <Grid container spacing={2}>
                {visibleClasses.map((c) => (
                  <Grid key={c.id} size={{ xs: 12, md: 6, xl: 4 }}>
                    <ClassCard
                      classGrade={c}
                      onEdit={() => setClassDialog({ editing: c })}
                      onDelete={() => {
                        setDeleteError(null);
                        setDeleteTarget({ kind: "class", id: c.id, label: c.name });
                      }}
                      onAddSection={() => setSectionDialog({ classGrade: c, editing: null })}
                      onEditSection={(s) => setSectionDialog({ classGrade: c, editing: s })}
                      onDeleteSection={(s) => {
                        setDeleteError(null);
                        setDeleteTarget({ kind: "section", id: s.id, label: `${c.name} – Section ${s.name}` });
                      }}
                      onAddSubject={() => setSubjectDialog({ editing: null, classId: c.id })}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {tab === 1 && !loading && (
          <TableContainer>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Session</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subjectRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState title="No subjects" body="Add subjects to a class to build its curriculum." />
                    </TableCell>
                  </TableRow>
                ) : (
                  subjectRows.map(({ subject, classGrade }, i) => (
                    <TableRow key={subject.id} hover>
                      <TableCell sx={{ color: "text.secondary", width: 48 }}>{i + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{subject.name}</TableCell>
                      <TableCell>
                        <Chip size="small" label={subject.code} sx={{ fontFamily: "monospace", fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              bgcolor: BAND_COLORS[gradeBand(classGrade.level_order)],
                            }}
                          />
                          <span>{classGrade.name}</span>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{classGrade.academic_year}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setSubjectDialog({ editing: subject, classId: classGrade.id })}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget({ kind: "subject", id: subject.id, label: `${subject.name} (${classGrade.name})` });
                            }}
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
        )}
      </Paper>

      {classDialog && (
        <ClassDialog
          open
          editing={classDialog.editing}
          years={years}
          defaultYearId={selectedYear?.id ?? activeYear?.id ?? ""}
          onClose={() => setClassDialog(null)}
          onSaved={saved}
        />
      )}
      {sectionDialog && (
        <SectionDialog
          open
          classGrade={sectionDialog.classGrade}
          editing={sectionDialog.editing}
          teachers={teachersQuery.data ?? []}
          onClose={() => setSectionDialog(null)}
          onSaved={saved}
        />
      )}
      {subjectDialog && (
        <SubjectDialog
          open
          classes={yearClasses}
          editing={subjectDialog.editing}
          defaultClassId={subjectDialog.classId}
          onClose={() => setSubjectDialog(null)}
          onSaved={saved}
        />
      )}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.kind ?? ""}?`}
        message={
          deleteTarget?.kind === "class"
            ? `"${deleteTarget.label}" and all of its sections and subjects will be removed. This is only allowed while no students, courses or records use it.`
            : `"${deleteTarget?.label}" will be removed. This is only allowed while nothing uses it.`
        }
        error={deleteError}
        pending={remove.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget)}
      />
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)} sx={{ minWidth: 260 }}>
          {toast}
        </Alert>
      </Snackbar>
    </AppShell>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center", py: 6 }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          bgcolor: `${tileColors.blue}14`,
          color: tileColors.blue,
          mb: 1,
        }}
      >
        <ClassIcon sx={{ fontSize: 30 }} />
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
        {body}
      </Typography>
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}
