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
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNewOutlined";
import SearchIcon from "@mui/icons-material/SearchOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { listClasses } from "../../../api/classes";
import { listResources, deleteResource } from "../../../api/resources";
import { resolveUploadUrl } from "../../../api/uploads";

export function AdminBooksPage() {
  const qc = useQueryClient();
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const books = useQuery({
    queryKey: ["resources", "book-admin", classFilter],
    queryFn: () => listResources({ classGradeId: classFilter || undefined, resourceType: "document" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources", "book-admin"] }),
  });

  const list = (books.data ?? []).filter((b) =>
    !search || b.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell navItems={adminNavItems} title="Books Library">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <MenuBookIcon color="primary" />
            <Box>
              <Typography variant="h5" fontWeight={700}>Books Library</Typography>
              <Typography variant="body2" color="text.secondary">
                All PDF books and study materials uploaded by teachers
              </Typography>
            </Box>
          </Stack>
          <Chip label={`${list.length} books`} color="error" />
        </Stack>

        {/* Filters */}
        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            placeholder="Search books…"
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

        {!books.isLoading && list.length === 0 && (
          <Alert severity="info">No books uploaded yet. Teachers can upload books from their portal.</Alert>
        )}

        <Grid container spacing={2}>
          {list.map((book) => {
            const fileUrl = book.file_url ? resolveUploadUrl(book.file_url) : book.external_url || "";
            return (
              <Grid item xs={12} sm={6} md={4} key={book.id}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                  <Box sx={{ bgcolor: "error.main", height: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", gap: 0.5 }}>
                    <PictureAsPdfIcon sx={{ fontSize: 38, color: "white" }} />
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
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom noWrap>{book.title}</Typography>
                    {book.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {book.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                      <Chip size="small" label="Textbook" color="error" variant="outlined" />
                    </Stack>
                  </CardContent>
                  {fileUrl && (
                    <Box sx={{ px: 2, pb: 2 }}>
                      <Button size="small" variant="outlined" color="error" startIcon={<OpenInNewIcon />} href={fileUrl} target="_blank" fullWidth>
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
    </AppShell>
  );
}
