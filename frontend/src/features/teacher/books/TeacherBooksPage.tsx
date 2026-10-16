import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import AddIcon from "@mui/icons-material/AddOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFileOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNewOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { listClasses, listSubjects } from "../../../api/classes";
import { listResources, createResource, deleteResource } from "../../../api/resources";
import { uploadDocument, resolveUploadUrl } from "../../../api/uploads";

function AddBookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const subjects = useQuery({
    queryKey: ["subjects", classId],
    queryFn: () => listSubjects(classId),
    enabled: !!classId,
  });

  const add = useMutation({
    mutationFn: async () => {
      setError("");
      if (!file) throw new Error("Please select a PDF file");
      setUploading(true);
      const fileUrl = await uploadDocument(file);
      setUploading(false);
      return createResource({
        title: title.trim(),
        description: description.trim() || undefined,
        resource_type: "document",
        file_url: fileUrl,
        class_grade_id: classId || undefined,
        subject_id: subjectId || undefined,
        category: "textbook",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", "book"] });
      setTitle(""); setDescription(""); setClassId(""); setSubjectId(""); setFile(null);
      onClose();
    },
    onError: (e: any) => {
      setUploading(false);
      setError(e.message || "Upload failed");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PictureAsPdfIcon color="error" />
          <Typography fontWeight={700}>Upload Book / Study Material</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* Class & Subject */}
          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Class *</InputLabel>
              <Select value={classId} label="Class *" onChange={(e) => { setClassId(e.target.value); setSubjectId(""); }}>
                {(classes.data ?? []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={!classId}>
              <InputLabel>Subject</InputLabel>
              <Select value={subjectId} label="Subject" onChange={(e) => setSubjectId(e.target.value)}>
                <MenuItem value="">All subjects</MenuItem>
                {(subjects.data ?? []).map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Title */}
          <TextField
            label="Book / Material Title *"
            size="small"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mathematics Textbook — Class 5"
          />

          {/* Description */}
          <TextField
            label="Description (optional)"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Chapter 1-5 covered in this book"
          />

          {/* File picker */}
          <Box>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              fullWidth
              color={file ? "success" : "primary"}
            >
              {file ? `✅ ${file.name}` : "Choose PDF File *"}
              <input
                type="file"
                hidden
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            {file && (
              <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: "block" }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB — ready to upload
              </Typography>
            )}
          </Box>

          {uploading && (
            <Box>
              <Typography variant="caption" color="text.secondary">Uploading PDF…</Typography>
              <LinearProgress sx={{ mt: 0.5 }} />
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="info" sx={{ py: 0.5 }}>
            After upload, students will see this book in their <strong>Books Library</strong> and can read it online.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!title.trim() || !classId || !file || add.isPending || uploading}
          onClick={() => add.mutate()}
        >
          {uploading ? "Uploading…" : "Upload Book"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function TeacherBooksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [classFilter, setClassFilter] = useState("");

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });

  const books = useQuery({
    queryKey: ["resources", "book", classFilter],
    queryFn: () => listResources({ classGradeId: classFilter || undefined, resourceType: "document" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources", "book"] }),
  });

  const list = books.data ?? [];

  return (
    <AppShell navItems={teacherNavItems} title="Books Library">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <MenuBookIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>Books Library</Typography>
          </Stack>
          <Button variant="contained" color="error" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Upload Book
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Upload PDF books and study materials. Students can read them online without downloading — <strong>no need to buy physical books!</strong>
        </Typography>

        {/* Class filter */}
        <FormControl size="small" sx={{ maxWidth: 200 }}>
          <InputLabel>Filter by Class</InputLabel>
          <Select value={classFilter} label="Filter by Class" onChange={(e) => setClassFilter(e.target.value)}>
            <MenuItem value="">All Classes</MenuItem>
            {(classes.data ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {!books.isLoading && list.length === 0 && (
          <Alert severity="info">
            No books uploaded yet. Click <strong>"Upload Book"</strong> to add your first textbook or study material.
          </Alert>
        )}

        {/* Books grid */}
        <Grid container spacing={2}>
          {list.map((book) => {
            const fileUrl = book.file_url ? resolveUploadUrl(book.file_url) : book.external_url || "";
            return (
              <Grid item xs={12} sm={6} md={4} key={book.id}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                  {/* Cover */}
                  <Box sx={{ bgcolor: "error.main", height: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", gap: 0.5 }}>
                    <PictureAsPdfIcon sx={{ fontSize: 40, color: "white" }} />
                    <Typography variant="caption" sx={{ color: "white", fontWeight: 600 }}>PDF Book</Typography>
                    <Tooltip title="Delete book">
                      <IconButton
                        size="small"
                        onClick={() => del.mutate(book.id)}
                        sx={{ position: "absolute", top: 6, right: 6, bgcolor: "rgba(0,0,0,0.4)", color: "white", "&:hover": { bgcolor: "rgba(0,0,0,0.7)" } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      {book.title}
                    </Typography>
                    {book.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {book.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
                      <Chip size="small" label="Textbook" color="error" variant="outlined" />
                    </Stack>
                  </CardContent>

                  {fileUrl && (
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<OpenInNewIcon />}
                        href={fileUrl}
                        target="_blank"
                        fullWidth
                      >
                        Preview PDF
                      </Button>
                    </Box>
                  )}
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Stack>

      <AddBookDialog open={open} onClose={() => setOpen(false)} />
    </AppShell>
  );
}
