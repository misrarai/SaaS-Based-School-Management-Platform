import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  Link,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { StudentsActionBar } from "./StudentsActionBar";
import { listClasses, listSections } from "../../../api/classes";
import { downloadImportSample, importStudents, type StudentImportResult } from "../../../api/students";

export function ImportStudentsPage() {
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<StudentImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sectionsQuery = useQuery({
    queryKey: ["sections", classGradeId],
    queryFn: () => listSections(classGradeId),
    enabled: !!classGradeId,
  });

  const importMutation = useMutation({
    mutationFn: () => importStudents(file!, classGradeId, sectionId || undefined),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: () => setError("Import failed — check the file format and try again."),
  });

  return (
    <AppShell title="Students" navItems={adminNavItems}>
      <Stack sx={{ mb: 2 }}>
        <StudentsActionBar active="import" />
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", mb: 2 }}>
        <Box sx={{ bgcolor: "#5c6b73", color: "#fff", px: 2, py: 1.2, display: "flex", justifyContent: "space-between" }}>
          <Typography sx={{ fontWeight: 600 }}>Import Bulk Students</Typography>
          <ExpandMoreIcon fontSize="small" />
        </Box>
        <Box sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", alignItems: "flex-start" }}>
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel id="import-class-label">Class</InputLabel>
              <Select
                labelId="import-class-label"
                label="Class"
                value={classGradeId}
                onChange={(e) => {
                  setClassGradeId(e.target.value);
                  setSectionId("");
                }}
              >
                {classesQuery.data?.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 220 }} disabled={!classGradeId}>
              <InputLabel id="import-section-label">Section (optional)</InputLabel>
              <Select
                labelId="import-section-label"
                label="Section (optional)"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                <MenuItem value="">No section</MenuItem>
                {sectionsQuery.data?.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Upload Excel file (
                <Link component="button" type="button" onClick={() => downloadImportSample()}>
                  Download Sample File
                </Link>
                )
              </Typography>
              <Button variant="outlined" component="label">
                Choose file
                <input
                  type="file"
                  accept=".xlsx"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Button>
              {file && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {file.name}
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result && (
        <Alert severity={result.failed.length ? "warning" : "success"} sx={{ mb: 2 }}>
          <Typography>
            Imported <strong>{result.created}</strong> student{result.created === 1 ? "" : "s"} successfully.
          </Typography>
          {!!result.failed.length && (
            <>
              <Typography sx={{ mt: 1 }}>{result.failed.length} row(s) failed:</Typography>
              <List dense>
                {result.failed.map((f) => (
                  <ListItem key={f.row} disableGutters>
                    <ListItemText primary={`Row ${f.row}: ${f.error}`} />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Alert>
      )}

      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          color="success"
          disabled={!file || !classGradeId || importMutation.isPending}
          onClick={() => importMutation.mutate()}
        >
          {importMutation.isPending ? "Importing…" : "Save"}
        </Button>
      </Stack>
    </AppShell>
  );
}
