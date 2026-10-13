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
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNewOutlined";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { listClasses } from "../../../api/classes";
import { listResources } from "../../../api/resources";
import { resolveUploadUrl } from "../../../api/uploads";

function PdfViewer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <PictureAsPdfIcon color="error" />
            <Typography fontWeight={700} noWrap sx={{ maxWidth: "80%" }}>{title}</Typography>
          </Stack>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ height: "75vh" }}>
          <iframe
            src={viewerUrl}
            style={{ width: "100%", height: "100%", border: 0 }}
            title={title}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export function ParentBooksPage() {
  const [classFilter, setClassFilter] = useState("");
  const [readingBook, setReadingBook] = useState<{ url: string; title: string } | null>(null);

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const books = useQuery({
    queryKey: ["resources", "book-parent", classFilter],
    queryFn: () => listResources({ classGradeId: classFilter || undefined, resourceType: "document" }),
  });

  const list = books.data ?? [];

  return (
    <AppShell navItems={parentNavItems} title="Books Library">
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <MenuBookIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Books Library</Typography>
            <Typography variant="body2" color="text.secondary">
              Read online textbooks and study materials uploaded by teachers
            </Typography>
          </Box>
        </Stack>

        <Alert severity="success" sx={{ py: 0.5 }}>
          📚 <strong>No need to buy physical books!</strong> All textbooks are available here — read them online for free.
        </Alert>

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
          <Alert severity="info">No books uploaded yet. Teachers will add textbooks and study materials soon.</Alert>
        )}

        {/* Books grid */}
        <Grid container spacing={2}>
          {list.map((book) => {
            const fileUrl = book.file_url ? resolveUploadUrl(book.file_url) : book.external_url || "";
            return (
              <Grid item xs={12} sm={6} md={4} key={book.id}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                  {/* Cover */}
                  <Box
                    sx={{
                      bgcolor: "error.main",
                      height: 120,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.5,
                      cursor: fileUrl ? "pointer" : "default",
                    }}
                    onClick={() => fileUrl && setReadingBook({ url: fileUrl, title: book.title })}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: 42, color: "white" }} />
                    <Typography variant="caption" sx={{ color: "white", fontWeight: 600 }}>PDF Book</Typography>
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
                      <Stack spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          fullWidth
                          onClick={() => setReadingBook({ url: fileUrl, title: book.title })}
                        >
                          Read Online
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<OpenInNewIcon />}
                          href={fileUrl}
                          target="_blank"
                          fullWidth
                        >
                          Open in New Tab
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Stack>

      {readingBook && (
        <PdfViewer
          url={readingBook.url}
          title={readingBook.title}
          onClose={() => setReadingBook(null)}
        />
      )}
    </AppShell>
  );
}
