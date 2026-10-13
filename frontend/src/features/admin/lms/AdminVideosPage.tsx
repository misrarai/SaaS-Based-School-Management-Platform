import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import PlayCircleIcon from "@mui/icons-material/PlayCircleOutlined";
import SearchIcon from "@mui/icons-material/SearchOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { listClasses } from "../../../api/classes";
import { listResources, deleteResource } from "../../../api/resources";

export function AdminVideosPage() {
  const qc = useQueryClient();
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

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
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <VideoLibraryIcon color="primary" />
            <Box>
              <Typography variant="h5" fontWeight={700}>Video Lectures</Typography>
              <Typography variant="body2" color="text.secondary">
                All videos uploaded by teachers across all classes
              </Typography>
            </Box>
          </Stack>
          <Chip label={`${list.length} videos`} color="primary" />
        </Stack>

        {/* Filters */}
        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            placeholder="Search videos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "action.active" }} /> }}
            sx={{ flex: 1, maxWidth: 300 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Filter by Class</InputLabel>
            <Select value={classFilter} label="Filter by Class" onChange={(e) => setClassFilter(e.target.value)}>
              <MenuItem value="">All Classes</MenuItem>
              {(classes.data ?? []).map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {!videos.isLoading && list.length === 0 && (
          <Alert severity="info">No videos found. Teachers can upload videos from their portal.</Alert>
        )}

        <Grid container spacing={2}>
          {list.map((v) => (
            <Grid item xs={12} sm={6} md={4} key={v.id}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                <Box sx={{ bgcolor: "primary.dark", height: 110, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <PlayCircleIcon sx={{ fontSize: 44, color: "white", opacity: 0.85 }} />
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
                    <Button size="small" href={v.external_url} target="_blank" sx={{ mt: 1, p: 0 }}>
                      Open link ↗
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </AppShell>
  );
}
