import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Link as MuiLink,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses, listSubjects } from "../../../api/classes";
import { resolveUploadUrl, uploadDocument } from "../../../api/uploads";
import { createResource, deleteResource, listResources, type Resource, type ResourceType } from "../../../api/resources";
import { useAuth } from "../../../auth/AuthContext";

function AddResourceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const subjectsQuery = useQuery({
    queryKey: ["subjects", classGradeId],
    queryFn: () => listSubjects(classGradeId),
    enabled: !!classGradeId,
  });
  const [subjectId, setSubjectId] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("link");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      let fileUrl: string | undefined;
      if (resourceType === "document") {
        if (!file) throw new Error("A file is required");
        setUploading(true);
        fileUrl = await uploadDocument(file);
        setUploading(false);
      }
      return createResource({
        title,
        description: description || undefined,
        resource_type: resourceType,
        external_url: resourceType === "link" ? externalUrl : undefined,
        file_url: fileUrl,
        class_grade_id: classGradeId || undefined,
        subject_id: subjectId || undefined,
        category: category || undefined,
      });
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setExternalUrl("");
      setCategory("");
      setFile(null);
      setError(null);
      onClose();
      queryClient.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: () => {
      setUploading(false);
      setError("Could not add resource.");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add a resource</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <ToggleButtonGroup
              value={resourceType}
              exclusive
              onChange={(_, v) => v && setResourceType(v)}
              size="small"
            >
              <ToggleButton value="link">Link</ToggleButton>
              <ToggleButton value="document">Upload document</ToggleButton>
            </ToggleButtonGroup>
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            {resourceType === "link" ? (
              <TextField
                label="URL"
                placeholder="https://..."
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                required
                fullWidth
              />
            ) : (
              <Button component="label" variant="outlined">
                {file ? file.name : "Choose file (PDF, Word, PowerPoint, Excel)"}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Button>
            )}
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="res-class-label">Class (optional)</InputLabel>
                <Select
                  labelId="res-class-label"
                  label="Class (optional)"
                  value={classGradeId}
                  onChange={(e) => {
                    setClassGradeId(e.target.value);
                    setSubjectId("");
                  }}
                >
                  <MenuItem value="">Any class</MenuItem>
                  {classesQuery.data?.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth disabled={!classGradeId}>
                <InputLabel id="res-subject-label">Subject (optional)</InputLabel>
                <Select
                  labelId="res-subject-label"
                  label="Subject (optional)"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  <MenuItem value="">Any subject</MenuItem>
                  {subjectsQuery.data?.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Category (optional)"
              placeholder="e.g. Past Papers/2023"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={create.isPending || uploading}>
            {uploading ? "Uploading…" : "Add"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function ResourceLibraryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const resourcesQuery = useQuery({
    queryKey: ["resources", classGradeId],
    queryFn: () => listResources({ classGradeId: classGradeId || undefined }),
  });
  const classNameById = Object.fromEntries((classesQuery.data ?? []).map((c) => [c.id, c.name]));

  const [dialogOpen, setDialogOpen] = useState(false);

  const remove = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resources"] }),
  });

  return (
    <AppShell title="Resource Library" navItems={teacherNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Resource Library</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add resource
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="filter-class-label">Class (optional)</InputLabel>
          <Select
            labelId="filter-class-label"
            label="Class (optional)"
            value={classGradeId}
            onChange={(e) => setClassGradeId(e.target.value)}
          >
            <MenuItem value="">All classes</MenuItem>
            {classesQuery.data?.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {resourcesQuery.data?.length === 0 && <Alert severity="info">No resources yet.</Alert>}

      {!!resourcesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourcesQuery.data.map((r: Resource) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <MuiLink
                      href={
                        r.resource_type === "link"
                          ? (r.external_url ?? undefined)
                          : r.file_url
                            ? resolveUploadUrl(r.file_url)
                            : undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {r.title}
                    </MuiLink>
                  </TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{r.resource_type}</TableCell>
                  <TableCell>{r.class_grade_id ? (classNameById[r.class_grade_id] ?? "—") : "Any"}</TableCell>
                  <TableCell>{r.category ?? "—"}</TableCell>
                  <TableCell align="right">
                    {r.uploaded_by_user_id === user?.id && (
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => remove.mutate(r.id)}>
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AddResourceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppShell>
  );
}
