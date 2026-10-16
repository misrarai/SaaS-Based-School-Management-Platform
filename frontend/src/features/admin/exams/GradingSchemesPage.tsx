import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
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
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHighOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createGradingScheme,
  deleteGradingScheme,
  listGradingSchemes,
  seedDefaultGradingScheme,
  updateGradingScheme,
  type GradingScheme,
} from "../../../api/exams";
import { ExamTabs } from "./ExamTabs";

interface BandForm {
  min_percent: string;
  max_percent: string;
  grade: string;
  gpa: string;
  remarks: string;
}

const NEW_BAND: BandForm = { min_percent: "", max_percent: "", grade: "", gpa: "", remarks: "" };

function errorMessage(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

export function GradingSchemesPage() {
  const queryClient = useQueryClient();
  const schemesQuery = useQuery({ queryKey: ["exams", "grading-schemes"], queryFn: listGradingSchemes });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["exams", "grading-schemes"] });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GradingScheme | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [bands, setBands] = useState<BandForm[]>([NEW_BAND]);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setIsDefault(!schemesQuery.data?.length);
    setBands([{ ...NEW_BAND }]);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(scheme: GradingScheme) {
    setEditing(scheme);
    setName(scheme.name);
    setIsDefault(scheme.is_default);
    setBands(
      scheme.bands.map((b) => ({
        min_percent: String(b.min_percent),
        max_percent: String(b.max_percent),
        grade: b.grade,
        gpa: b.gpa != null ? String(b.gpa) : "",
        remarks: b.remarks ?? "",
      })),
    );
    setError(null);
    setDialogOpen(true);
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        is_default: isDefault,
        bands: bands.map((b) => ({
          min_percent: Number(b.min_percent),
          max_percent: Number(b.max_percent),
          grade: b.grade.trim(),
          gpa: b.gpa === "" ? null : Number(b.gpa),
          remarks: b.remarks.trim() || null,
        })),
      };
      return editing ? updateGradingScheme(editing.id, payload) : createGradingScheme(payload);
    },
    onSuccess: () => {
      setDialogOpen(false);
      invalidate();
    },
    onError: (err) => setError(errorMessage(err, "Could not save grading scheme.")),
  });

  const seed = useMutation({ mutationFn: seedDefaultGradingScheme, onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: (id: string) => deleteGradingScheme(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(errorMessage(err, "Could not delete grading scheme.")),
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => updateGradingScheme(id, { is_default: true }),
    onSuccess: invalidate,
  });

  function updateBand(index: number, patch: Partial<BandForm>) {
    setBands((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  return (
    <AppShell title="Examinations" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h4">Grading Schemes</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AutoFixHighIcon />} onClick={() => seed.mutate()} disabled={seed.isPending}>
            Add standard scheme
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New scheme
          </Button>
        </Stack>
      </Stack>
      <ExamTabs current="schemes" />

      {schemesQuery.data?.length === 0 && (
        <Alert severity="info">
          No grading schemes yet. Click "Add standard scheme" for a ready-made A+ to F scale, or build your own.
          Exams without a scheme use the built-in standard scale.
        </Alert>
      )}

      <Stack spacing={2}>
        {schemesQuery.data?.map((scheme) => (
          <Paper key={scheme.id} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="h6">{scheme.name}</Typography>
                {scheme.is_default && <Chip size="small" color="success" label="Default" />}
              </Stack>
              <Stack direction="row" spacing={0.5}>
                {!scheme.is_default && (
                  <Button size="small" onClick={() => makeDefault.mutate(scheme.id)}>
                    Make default
                  </Button>
                )}
                <IconButton size="small" onClick={() => openEdit(scheme)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => window.confirm(`Delete "${scheme.name}"?`) && remove.mutate(scheme.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead sx={darkTableHeadSx}>
                  <TableRow>
                    <TableCell>Grade</TableCell>
                    <TableCell>Percentage range</TableCell>
                    <TableCell>GPA</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scheme.bands.map((b) => (
                    <TableRow key={b.id ?? b.grade}>
                      <TableCell sx={{ fontWeight: 600 }}>{b.grade}</TableCell>
                      <TableCell>
                        {b.min_percent}% – {b.max_percent}%
                      </TableCell>
                      <TableCell>{b.gpa ?? "—"}</TableCell>
                      <TableCell>{b.remarks ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ))}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? "Edit grading scheme" : "New grading scheme"}</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <TextField label="Scheme name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
                <FormControlLabel
                  control={<Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
                  label="Default"
                />
              </Stack>
              <Typography variant="subtitle2">Grade bands</Typography>
              {bands.map((band, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TextField
                    size="small"
                    label="Grade"
                    value={band.grade}
                    onChange={(e) => updateBand(i, { grade: e.target.value })}
                    required
                    sx={{ width: 90 }}
                  />
                  <TextField
                    size="small"
                    label="Min %"
                    type="number"
                    value={band.min_percent}
                    onChange={(e) => updateBand(i, { min_percent: e.target.value })}
                    required
                    slotProps={{ htmlInput: { min: 0, max: 100, step: "0.01" } }}
                    sx={{ width: 100 }}
                  />
                  <TextField
                    size="small"
                    label="Max %"
                    type="number"
                    value={band.max_percent}
                    onChange={(e) => updateBand(i, { max_percent: e.target.value })}
                    required
                    slotProps={{ htmlInput: { min: 0, max: 100, step: "0.01" } }}
                    sx={{ width: 100 }}
                  />
                  <TextField
                    size="small"
                    label="GPA"
                    type="number"
                    value={band.gpa}
                    onChange={(e) => updateBand(i, { gpa: e.target.value })}
                    slotProps={{ htmlInput: { min: 0, max: 10, step: "0.01" } }}
                    sx={{ width: 90 }}
                  />
                  <TextField
                    size="small"
                    label="Remarks"
                    value={band.remarks}
                    onChange={(e) => updateBand(i, { remarks: e.target.value })}
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    size="small"
                    disabled={bands.length === 1}
                    onClick={() => setBands((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Box>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setBands((prev) => [...prev, { ...NEW_BAND }])}>
                  Add band
                </Button>
              </Box>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
