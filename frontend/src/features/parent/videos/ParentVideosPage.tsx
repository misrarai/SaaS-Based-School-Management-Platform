import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import PlayCircleIcon from "@mui/icons-material/PlayCircleOutlined";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { listClasses } from "../../../api/classes";
import { listResources } from "../../../api/resources";
import { resolveUploadUrl } from "../../../api/uploads";

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function VideoPlayer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const ytId = extractYouTubeId(url);
  const vimeoId = !ytId ? extractVimeoId(url) : null;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography fontWeight={700} noWrap sx={{ maxWidth: "80%" }}>{title}</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ position: "relative", paddingTop: "56.25%", bgcolor: "black" }}>
          {ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : vimeoId ? (
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1`}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <video
              src={url}
              controls
              autoPlay
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export function ParentVideosPage() {
  const [classFilter, setClassFilter] = useState("");
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null);

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const videos = useQuery({
    queryKey: ["resources", "video", classFilter],
    queryFn: () => listResources({ classGradeId: classFilter || undefined, resourceType: "video" }),
  });

  const list = videos.data ?? [];

  return (
    <AppShell navItems={parentNavItems} title="Video Lectures">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <VideoLibraryIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Video Lectures</Typography>
            <Typography variant="body2" color="text.secondary">
              Watch video lectures uploaded by your child's teachers
            </Typography>
          </Box>
        </Stack>

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

        {!videos.isLoading && list.length === 0 && (
          <Alert severity="info">No video lectures available yet. Teachers will upload videos soon.</Alert>
        )}

        {/* Video grid */}
        <Grid container spacing={2}>
          {list.map((v) => {
            const url = v.external_url || (v.file_url ? resolveUploadUrl(v.file_url) : "");
            const ytId = url ? extractYouTubeId(url) : null;
            return (
              <Grid item xs={12} sm={6} md={4} key={v.id}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                  {/* Thumbnail / cover */}
                  <Box
                    sx={{
                      height: 140,
                      position: "relative",
                      overflow: "hidden",
                      bgcolor: "primary.dark",
                      cursor: url ? "pointer" : "default",
                    }}
                    onClick={() => url && setPlayingVideo({ url, title: v.title })}
                  >
                    {ytId ? (
                      <Box
                        component="img"
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        alt={v.title}
                      />
                    ) : (
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <PlayCircleIcon sx={{ fontSize: 52, color: "white", opacity: 0.85 }} />
                      </Box>
                    )}
                    {/* Play overlay */}
                    {url && (
                      <Box sx={{
                        position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: 0, transition: "opacity 0.2s", "&:hover": { opacity: 1 },
                      }}>
                        <PlayCircleIcon sx={{ fontSize: 52, color: "white" }} />
                      </Box>
                    )}
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
                      <Chip size="small" label={v.external_url ? "YouTube/URL" : "Uploaded"} color={v.external_url ? "error" : "primary"} variant="outlined" />
                    </Stack>
                    {url && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PlayCircleIcon />}
                        sx={{ mt: 1 }}
                        onClick={() => setPlayingVideo({ url, title: v.title })}
                        fullWidth
                      >
                        Watch Video
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Stack>

      {playingVideo && (
        <VideoPlayer
          url={playingVideo.url}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
        />
      )}
    </AppShell>
  );
}
