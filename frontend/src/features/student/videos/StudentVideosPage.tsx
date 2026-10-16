import { useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardActionArea,
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
import PlayCircleIcon from "@mui/icons-material/PlayCircleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import VideoLibraryIcon from "@mui/icons-material/VideoLibraryOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { listResources, type Resource } from "../../../api/resources";
import { listSubjects } from "../../../api/classes";
import { resolveUploadUrl } from "../../../api/uploads";
import { getMyStudentProfile } from "../../../api/students";

function isYouTube(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}
function getYouTubeEmbed(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}
function isVimeo(url: string) {
  return url.includes("vimeo.com");
}
function getVimeoEmbed(url: string) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}`;
  return url;
}

interface VideoPlayerProps {
  video: Resource | null;
  onClose: () => void;
}

function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  if (!video) return null;

  const rawUrl = video.external_url || (video.file_url ? resolveUploadUrl(video.file_url) : "");

  let embedUrl = rawUrl;
  let isEmbed = false;

  if (rawUrl && isYouTube(rawUrl)) {
    embedUrl = getYouTubeEmbed(rawUrl);
    isEmbed = true;
  } else if (rawUrl && isVimeo(rawUrl)) {
    embedUrl = getVimeoEmbed(rawUrl);
    isEmbed = true;
  }

  return (
    <Dialog open={!!video} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {video.title}
        <IconButton onClick={onClose} sx={{ position: "absolute", top: 8, right: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {isEmbed ? (
          <Box
            component="iframe"
            src={embedUrl}
            sx={{ width: "100%", height: { xs: 240, sm: 360, md: 440 }, border: "none", display: "block" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : rawUrl ? (
          <Box
            component="video"
            controls
            sx={{ width: "100%", display: "block", bgcolor: "#000" }}
            src={embedUrl}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">Video URL not available.</Alert>
          </Box>
        )}
        {video.description && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {video.description}
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StudentVideosPage() {
  const [subjectId, setSubjectId] = useState("");
  const [playing, setPlaying] = useState<Resource | null>(null);

  const profile = useQuery({ queryKey: ["students", "me"], queryFn: getMyStudentProfile });

  const subjects = useQuery({
    queryKey: ["subjects", profile.data?.class_grade_id],
    queryFn: () => listSubjects(profile.data!.class_grade_id!),
    enabled: !!profile.data?.class_grade_id,
  });

  const videos = useQuery({
    queryKey: ["resources", "video", profile.data?.class_grade_id, subjectId],
    queryFn: () =>
      listResources({
        classGradeId: profile.data?.class_grade_id ?? undefined,
        subjectId: subjectId || undefined,
        resourceType: "video",
      }),
    enabled: !!profile.data,
  });

  const list = videos.data ?? [];

  return (
    <AppShell navItems={studentNavItems} title="Video Lectures">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <VideoLibraryIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Video Lectures
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Watch video lectures uploaded by your teachers. Filter by subject.
        </Typography>

        {/* Subject filter */}
        <FormControl size="small" sx={{ maxWidth: 220 }}>
          <InputLabel>Filter by Subject</InputLabel>
          <Select
            value={subjectId}
            label="Filter by Subject"
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <MenuItem value="">All Subjects</MenuItem>
            {(subjects.data ?? []).map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {!videos.isLoading && list.length === 0 && (
          <Alert severity="info">
            No video lectures available yet. Your teachers will upload videos here.
          </Alert>
        )}

        {/* Video grid */}
        <Grid container spacing={2}>
          {list.map((v) => (
            <Grid item xs={12} sm={6} md={4} key={v.id}>
              <Card
                variant="outlined"
                sx={{ borderRadius: 2, height: "100%", display: "flex", flexDirection: "column" }}
              >
                <CardActionArea
                  onClick={() => setPlaying(v)}
                  sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch" }}
                >
                  {/* Thumbnail area */}
                  <Box
                    sx={{
                      bgcolor: "primary.dark",
                      height: 140,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PlayCircleIcon sx={{ fontSize: 56, color: "white", opacity: 0.9 }} />
                  </Box>
                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      {v.title}
                    </Typography>
                    {v.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {v.description}
                      </Typography>
                    )}
                    {v.category && (
                      <Chip
                        size="small"
                        label={v.category}
                        variant="outlined"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>

      <VideoPlayer video={playing} onClose={() => setPlaying(null)} />
    </AppShell>
  );
}
