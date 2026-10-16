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
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import AddIcon from "@mui/icons-material/AddOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import PlayCircleIcon from "@mui/icons-material/PlayCircleOutlined";
import LinkIcon from "@mui/icons-material/LinkOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFileOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses, listSubjects } from "../../../api/classes";
import { listResources, createResource, deleteResource } from "../../../api/resources";
import { uploadDocument } from "../../../api/uploads";

type UploadMode = "youtube" | "file";

function AddVideoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<UploadMode>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
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
      let fileUrl: string | undefined;
      let externalUrl: string | undefined;

      if (mode === "youtube") {
        if (!youtubeUrl.trim()) throw new Error("Please enter a YouTube/video URL");
        externalUrl = youtubeUrl.trim();
      } else {
        if (!file) throw new Error("Please select a video file");
        setUploading(true);
        fileUrl = await uploadDocument(file);
        setUploading(false);
      }

      return createResource({
        title: title.trim(),
        description: description.trim() || undefined,
        resource_type: "video",
        external_url: externalUrl,
        file_url: fileUrl,
        class_grade_id: classId || undefined,
        subject_id: subjectId || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", "video"] });
      setTitle(""); setDescription(""); setYoutubeUrl(""); setClassId("");
      setSubjectId(""); setFile(null);
      onClose();
    },
    onError: (e: any) => setError(e.message || "Upload failed"),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PlayCircleIcon color="primary" />
          <Typography fontWeight={700}>Upload Video Lecture</Typography>
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
          <TextField label="Video Title *" size="small" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 3 — Fractions" />

          {/* Description */}
          <TextField label="Description (optional)" size="small" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

          {/* Upload mode */}
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant={mode === "youtube" ? "contained" : "outlined"}
              startIcon={<LinkIcon />}
              onClick={() => setMode("youtube")}
              sx={{ flex: 1 }}
            >
              YouTube / URL
            </Button>
            <Button
              size="small"
              variant={mode === "file" ? "contained" : "outlined"}
              startIcon={<UploadFileIcon />}
              onClick={() => setMode("file")}
              sx={{ flex: 1 }}
            >
              Upload File
            </Button>
          </Stack>

          {/* YouTube URL */}
          {mode === "youtube" && (
            <TextField
              label="YouTube / Vimeo / Video URL *"
              size="small"
              fullWidth
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              helperText="Paste any YouTube, Vimeo or direct video link"
            />
          )}

          {/* File upload */}
          {mode === "file" && (
            <Box>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} fullWidth>
                {file ? file.name : "Choose Video File (MP4, WebM)"}
                <input
                  type="file"
                  hidden
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Button>
              {file && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </Typography>
              )}
            </Box>
          )}

          {uploading && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!title.trim() || !classId || add.isPending || uploading}
          onClick={() => add.mutate()}
        >
          {add.isPending || uploading ? "Uploading…" : "Upload Video"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function TeacherVideosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [classFilter, setClassFilter] = useState("");

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const videos = useQuery({
    queryKey: ["resources", "video", classFilter],
    queryFn: () => listResources({ classGradeId: classFilter || undefined, resourceType: "video" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources", "video"] }),
  });

  const list = videos.data ?? [];

  return (
    <AppShell navItems={teacherNavItems} title="Video Lectures">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <VideoLibraryIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>Video Lectures</Typography>
          </Stack>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Upload Video
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Upload YouTube links or video files. Students will see them in their <strong>Video Lectures</strong> section.
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

        {/* Video grid */}
        {!videos.isLoading && list.length === 0 && (
          <Alert severity="info">No videos uploaded yet. Click "Upload Video" to add your first lecture.</Alert>
        )}

        <Grid container spacing={2}>
          {list.map((v) => (
            <Grid item xs={12} sm={6} md={4} key={v.id}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                {/* Thumbnail */}
                <Box sx={{ bgcolor: "primary.dark", height: 120, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <PlayCircleIcon sx={{ fontSize: 48, color: "white", opacity: 0.9 }} />
                  <Tooltip title="Delete video">
                    <IconButton
                      size="small"
                      onClick={() => del.mutate(v.id)}
                      sx={{ position: "absolute", top: 6, right: 6, bgcolor: "rgba(0,0,0,0.5)", color: "white", "&:hover": { bgcolor: "error.main" } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    {v.title}
                  </Typography>
                  {v.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {v.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
                    {v.class_grade_id && <Chip size="small" label="Class" variant="outlined" />}
                    <Chip size="small" label={v.external_url ? "YouTube/URL" : "Uploaded"} color={v.external_url ? "error" : "primary"} variant="outlined" />
                  </Stack>
                  {v.external_url && (
                    <Button size="small" href={v.external_url} target="_blank" sx={{ mt: 1, p: 0 }}>
                      Preview Link ↗
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>

      <AddVideoDialog open={open} onClose={() => setOpen(false)} />
    </AppShell>
  );
}
