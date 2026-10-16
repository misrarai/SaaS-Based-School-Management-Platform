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
  Tooltip,
  Typography,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/FolderOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFileOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlineOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNewOutlined";
import SearchIcon from "@mui/icons-material/SearchOutlined";
import AddIcon from "@mui/icons-material/AddOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listStudents } from "../../../api/students";
import { listClasses } from "../../../api/classes";
import { uploadDocument, resolveUploadUrl } from "../../../api/uploads";
import { createResource, deleteResource, listResources } from "../../../api/resources";

const DOC_TYPES = [
  "Birth Certificate",
  "CNIC / B-Form",
  "Transfer Certificate",
  "Character Certificate",
  "Previous Result",
  "Passport Photo",
  "Medical Certificate",
  "Domicile",
  "Other",
];

interface Student { id: string; full_name: string; admission_number?: string | null; }

function UploadDialog({
  open, onClose, student,
}: { open: boolean; onClose: () => void; student: Student }) {
  const qc = useQueryClient();
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setTitle(""); setFile(null); setDocType(DOC_TYPES[0]); setError("");
  }

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please select a file");
      setUploading(true);
      const fileUrl = await uploadDocument(file);
      setUploading(false);
      return createResource({
        title: title.trim() || docType,
        resource_type: "document",
        file_url: fileUrl,
        category: docType,
        description: `__student:${student.id}__ ${student.full_name} | ${docType}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-docs", student.id] });
      reset();
      onClose();
    },
    onError: (e: any) => { setUploading(false); setError(e.message || "Upload failed"); },
  });

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <UploadFileIcon color="primary" />
          <Typography fontWeight={700}>Upload Document — {student.full_name}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Document Type *</InputLabel>
            <Select value={docType} label="Document Type *" onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="Custom Title (optional)"
            size="small"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={docType}
          />
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} fullWidth color={file ? "success" : "primary"}>
            {file ? `✅ ${file.name}` : "Choose File (PDF / Image / Word)"}
            <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Button>
          {file && <Typography variant="caption" color="success.main">{(file.size / 1024 / 1024).toFixed(2)} MB — ready to upload</Typography>}
          {uploading && <><Typography variant="caption" color="text.secondary">Uploading…</Typography><LinearProgress sx={{ mt: 0.5 }} /></>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button variant="contained" disabled={!file || upload.isPending || uploading} onClick={() => upload.mutate()}>
          {uploading ? "Uploading…" : "Upload Document"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function StudentDocumentsPage() {
  const qc = useQueryClient();
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const students = useQuery({
    queryKey: ["students", "docs-list", classFilter],
    queryFn: () => listStudents({ classGradeId: classFilter || undefined, status: "active" }),
  });

  const docs = useQuery({
    queryKey: ["student-docs", selectedStudent?.id],
    queryFn: () => listResources({ resourceType: "document" }),
    enabled: !!selectedStudent,
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student-docs", selectedStudent?.id] }),
  });

  const filteredStudents = (students.data ?? []).filter((s) =>
    !search ||
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.admission_number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const studentDocs = selectedStudent
    ? (docs.data ?? []).filter((d) => d.description?.includes(`__student:${selectedStudent.id}__`))
    : [];

  return (
    <AppShell navItems={adminNavItems} title="Student Documents">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <FolderIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Student Documents</Typography>
            <Typography variant="body2" color="text.secondary">
              Upload and manage official documents (Birth Certificate, CNIC, TC, etc.)
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={2}>
          {/* Student list */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Select Student</Typography>
                <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                  <TextField
                    size="small" fullWidth placeholder="Search name / admission no…"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "action.active" }} /> }}
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Class</InputLabel>
                    <Select value={classFilter} label="Class" onChange={(e) => { setClassFilter(e.target.value); setSelectedStudent(null); }}>
                      <MenuItem value="">All Classes</MenuItem>
                      {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
                <Box sx={{ maxHeight: 440, overflowY: "auto" }}>
                  {filteredStudents.map((s) => (
                    <Box
                      key={s.id}
                      onClick={() => setSelectedStudent(s)}
                      sx={{
                        p: 1.5, borderRadius: 1.5, cursor: "pointer", mb: 0.5,
                        bgcolor: selectedStudent?.id === s.id ? "primary.main" : "transparent",
                        color: selectedStudent?.id === s.id ? "white" : "text.primary",
                        "&:hover": { bgcolor: selectedStudent?.id === s.id ? "primary.dark" : "action.hover" },
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>{s.full_name}</Typography>
                      {s.admission_number && (
                        <Typography variant="caption" sx={{ opacity: 0.75 }}>#{s.admission_number}</Typography>
                      )}
                    </Box>
                  ))}
                  {filteredStudents.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>No students found</Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Documents panel */}
          <Grid item xs={12} md={8}>
            <Card variant="outlined" sx={{ borderRadius: 2, minHeight: 300 }}>
              <CardContent>
                {!selectedStudent ? (
                  <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
                    <FolderIcon sx={{ fontSize: 64, color: "action.disabled", mb: 2 }} />
                    <Typography color="text.secondary">Select a student to view their documents</Typography>
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>{selectedStudent.full_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{studentDocs.length} document(s) on file</Typography>
                      </Box>
                      <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setUploadOpen(true)}>
                        Upload Document
                      </Button>
                    </Stack>

                    {studentDocs.length === 0 && !docs.isLoading && (
                      <Alert severity="info">No documents uploaded yet. Click "Upload Document" to add files.</Alert>
                    )}

                    {studentDocs.length > 0 && (
                      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead sx={darkTableHeadSx}>
                            <TableRow>
                              <TableCell>Document Title</TableCell>
                              <TableCell>Type</TableCell>
                              <TableCell align="right">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {studentDocs.map((d) => {
                              const url = d.file_url ? resolveUploadUrl(d.file_url) : "";
                              return (
                                <TableRow key={d.id} hover>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight={600}>{d.title}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip size="small" label={d.category || "Document"} variant="outlined" />
                                  </TableCell>
                                  <TableCell align="right">
                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                      {url && (
                                        <Tooltip title="View / Download">
                                          <IconButton size="small" href={url} target="_blank"><OpenInNewIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                      )}
                                      <Tooltip title="Delete">
                                        <IconButton size="small" color="error" onClick={() => del.mutate(d.id)}><DeleteIcon fontSize="small" /></IconButton>
                                      </Tooltip>
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>

      {selectedStudent && (
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          student={selectedStudent}
        />
      )}
    </AppShell>
  );
}
