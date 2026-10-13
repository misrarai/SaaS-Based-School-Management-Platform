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
import SearchIcon from "@mui/icons-material/SearchOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
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

  function reset() {
    setTitle(""); setDescription(""); setYoutubeUrl(""); setClassId("");
    setSubjectId(""); setFile(null); setError(""); setMode("youtube");
  }

  const add = useMutation({
    mutationFn: async () => {
      setError("");
      let fileUrl: string | undefined;
      let externalUrl: string | undefined;
      if (mode === "youtube") {
        if (!youtubeUrl.trim()) throw new Error("Please enter a video URL");
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
      qc.invalidateQueries({ queryKey: ["resources", "video-admin"] });
      reset(); onClose();
    },
    onError: (e: any) => { setUploading(false); setError(e.message || "Upload failed"); },
  });

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PlayCircleIcon color="primary" />
          <Typography fontWeight={700}>Upload Video Lecture</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Class *</InputLabel>
              <Select value={classId} label="Class *" onChange={(e) => { setClassId(e.target.value); setSubjectId(""); }}>
                {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={!classId}>
              <InputLabel>Subject</InputLabel>
              <Select value={subjectId} label="Subject" onChange={(e) => setSubjectId(e.target.value)}>
                <MenuItem value="">All subjects</MenuItem>
                {(subjects.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <TextField label="Video Title *" size="small" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 3 — Fractions" />
          <TextField label="Description (optional)" size="small" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

          <Stack direction="row" spacing={1}>
            <Button size="small" variant={mode === "youtube" ? "contained" : "outlined"} startIcon={<LinkIcon />} onClick={() => setMode("youtube")} sx={{ flex: 1 }}>
              YouTube / URL
            </Button>
            <Button size="small" variant={mode === "file" ? "contained" : "outlined"} startIcon={<UploadFileIcon />} onClick={() => setMode("file")} sx={{ flex: 1 }}>
              Upload File
            </Button>
          </Stack>

          {mode === "youtube" && (
            <TextField
              label="YouTube / Vimeo / Video URL *"
              size="small" fullWidth
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              helperText="Paste any YouTube, Vimeo or direct video link"
            />
          )}

          {mode === "file" && (
            <Box>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} fullWidth>
                {file ? file.name : "Choose Video File (MP4, WebM)"}
                <input type="file" hidden accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </Button>
              {file && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{(file.size / 1024 / 1024).toFixed(1)} MB</Typography>}
            </Box>
          )}

          {uploading && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button variant="contained" disabled={!title.trim() || !classId || add.isPending || uploading} onClick={() => add.mutate()}>
          {add.isPending || uploading ? "Uploading…" : "Upload Video"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AdminVideosPage() {
  const qc = useQueryClient();
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const videos = useQuery({
    queryKey: ["resources", "video-admin", classFilter],
    queryFn: () => listResources({ classGradeId: classFilter || undefined, resourceType: "video" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources", "video-admin"] }),
  });

  const list = (videos.data ?? []).filter((v) =>
    !search || v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell navItems={adminNavItems} title="Video Lectures">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <VideoLibraryIcon color="primary" />
            <Box>
              <Typography variant="h5" fontWeight={700}>Video Lectures</Typography>
              <Typography variant="body2" color="text.secondary">Upload and manage video lectures for all classes</Typography>
            </Box>
          </Stack>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Upload Video
          </Button>
        </Stack>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <TextField
            size="small" placeholder="Search videos…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "action.active" }} /> }}
            sx={{ flex: 1, maxWidth: 300 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Filter by Class</InputLabel>
            <Select value={classFilter} label="Filter by Class" onChange={(e) => setClassFilter(e.target.value)}>
              <MenuItem value="">All Classes</MenuItem>
              {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>

        {!videos.isLoading && list.length === 0 && (
          <Alert severity="info">No videos found. Click "Upload Video" to add the first lecture.</Alert>
        )}

        <Grid container spacing={2}>
          {list.map((v) => (
            <Grid item xs={12} sm={6} md={4} key={v.id}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                <Box sx={{ bgcolor: "primary.dark", height: 110, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <PlayCircleIcon sx={{ fontSize: 44, color: "white", opacity: 0.85 }} />
                  <Tooltip title="Delete video">
                    <IconButton size="small" onClick={() => del.mutate(v.id)}
                      sx={{ position: "absolute", top: 6, right: 6, bgcolor: "rgba(0,0,0,0.5)", color: "white", "&:hover": { bgcolor: "error.main" } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom noWrap>{v.title}</Typography>
                  {v.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {v.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
                    <Chip size="small" label={v.external_url ? "YouTube/URL" : "Uploaded"} color={v.external_url ? "error" : "primary"} variant="outlined" />
                  </Stack>
                  {v.external_url && (
                    <Button size="small" href={v.external_url} target="_blank" sx={{ mt: 1, p: 0 }}>Open link ↗</Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>

      <AddVideoDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </AppShell>
  );
}
