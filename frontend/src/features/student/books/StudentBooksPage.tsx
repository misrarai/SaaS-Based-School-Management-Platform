import { useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNewOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { listResources, type Resource } from "../../../api/resources";
import { listSubjects } from "../../../api/classes";
import { resolveUploadUrl } from "../../../api/uploads";
import { getMyStudentProfile } from "../../../api/students";

function getDocUrl(r: Resource): string {
  if (r.external_url) return r.external_url;
  if (r.file_url) return resolveUploadUrl(r.file_url);
  return "";
}

function isPdf(url: string) {
  return url.toLowerCase().includes(".pdf") || url.includes("application/pdf");
}

interface PdfViewerProps {
  book: Resource | null;
  onClose: () => void;
}

function PdfViewer({ book, onClose }: PdfViewerProps) {
  if (!book) return null;
  const url = getDocUrl(book);

  // Embed Google Docs viewer for PDFs hosted elsewhere
  const viewerUrl = isPdf(url)
    ? `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`
    : url;

  return (
    <Dialog open={!!book} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 8 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PictureAsPdfIcon color="error" />
          <Typography fontWeight={700}>{book.title}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ position: "absolute", top: 8, right: 8 }}>
          <IconButton
            size="small"
            href={url}
            target="_blank"
            title="Open in new tab"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0, height: "80vh" }}>
        {url ? (
          <Box
            component="iframe"
            src={viewerUrl}
            sx={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title={book.title}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">Book URL not available.</Alert>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StudentBooksPage() {
  const [subjectId, setSubjectId] = useState("");
  const [openBook, setOpenBook] = useState<Resource | null>(null);

  const profile = useQuery({ queryKey: ["students", "me"], queryFn: getMyStudentProfile });

  const subjects = useQuery({
    queryKey: ["subjects", profile.data?.class_grade_id],
    queryFn: () => listSubjects(profile.data!.class_grade_id!),
    enabled: !!profile.data?.class_grade_id,
  });

  const books = useQuery({
    queryKey: ["resources", "document", profile.data?.class_grade_id, subjectId],
    queryFn: () =>
      listResources({
        classGradeId: profile.data?.class_grade_id ?? undefined,
        subjectId: subjectId || undefined,
        resourceType: "document",
      }),
    enabled: !!profile.data,
  });

  // Also fetch notes (worksheets can also be books)
  const notes = useQuery({
    queryKey: ["resources", "notes", profile.data?.class_grade_id, subjectId],
    queryFn: () =>
      listResources({
        classGradeId: profile.data?.class_grade_id ?? undefined,
        subjectId: subjectId || undefined,
        resourceType: "notes",
      }),
    enabled: !!profile.data,
  });

  const list = [...(books.data ?? []), ...(notes.data ?? [])];

  return (
    <AppShell navItems={studentNavItems} title="Books Library">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <MenuBookIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            📚 Books Library
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Read your textbooks and notes online — no need to buy physical books!
          Your teachers upload books and study materials here.
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

        {!books.isLoading && !notes.isLoading && list.length === 0 && (
          <Alert severity="info">
            📖 No books uploaded yet. When your teacher uploads a book, it will appear
            here and you can read it online.
          </Alert>
        )}

        {/* Books grid */}
        <Grid container spacing={2}>
          {list.map((book) => (
            <Grid item xs={12} sm={6} md={4} key={book.id}>
              <Card
                variant="outlined"
                sx={{ borderRadius: 2, height: "100%", display: "flex", flexDirection: "column" }}
              >
                <CardActionArea
                  onClick={() => setOpenBook(book)}
                  sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch" }}
                >
                  {/* Book cover area */}
                  <Box
                    sx={{
                      bgcolor: "error.main",
                      height: 120,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                    }}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: 40, color: "white" }} />
                    <Typography variant="caption" sx={{ color: "white", fontWeight: 600, px: 2, textAlign: "center" }}>
                      {book.category || "Book"}
                    </Typography>
                  </Box>

                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      {book.title}
                    </Typography>
                    {book.description && (
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
                        {book.description}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>

                {/* Action buttons */}
                <Box sx={{ p: 1, pt: 0, display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    fullWidth
                    onClick={() => setOpenBook(book)}
                    startIcon={<MenuBookIcon />}
                  >
                    Read Online
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    href={getDocUrl(book)}
                    target="_blank"
                    startIcon={<OpenInNewIcon />}
                    disabled={!getDocUrl(book)}
                  >
                    Open
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>

      <PdfViewer book={openBook} onClose={() => setOpenBook(null)} />
    </AppShell>
  );
}
