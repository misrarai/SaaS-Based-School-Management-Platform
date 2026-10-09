import { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { fetchIdCardPdf, type Student } from "../../../api/students";
import { apiErrorMessage, saveBlob } from "../../../lib/apiError";
import { useClassSectionStudents } from "./ClassSectionFilter";

function fileName(s: Student) {
  return `id-card-${(s.admission_number || s.full_name).replace(/[^\w-]+/g, "_")}.pdf`;
}

export function StudentCardsPage() {
  const { classId, students, isLoading, filters, classNameOf, sectionNameOf } = useClassSectionStudents();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadOne(s: Student) {
    setError(null);
    setBusyId(s.id);
    try {
      saveBlob(await fetchIdCardPdf(s.id), fileName(s));
    } catch (err) {
      setError(apiErrorMessage(err, `Could not generate ID card for ${s.full_name}.`));
    } finally {
      setBusyId(null);
    }
  }

  async function downloadAll() {
    setError(null);
    setBulk({ done: 0, total: students.length });
    const failed: string[] = [];
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      try {
        saveBlob(await fetchIdCardPdf(s.id), fileName(s));
      } catch {
        failed.push(s.full_name);
      }
      setBulk({ done: i + 1, total: students.length });
    }
    setBulk(null);
    if (failed.length) setError(`Failed for: ${failed.join(", ")}`);
  }

  return (
    <AppShell title="Student Cards" navItems={adminNavItems}>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
          {filters}
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={!students.length || !!bulk}
            onClick={downloadAll}
          >
            Download all ({students.length})
          </Button>
        </Stack>
        {bulk && (
          <Stack spacing={0.5} sx={{ mt: 2 }}>
            <Typography variant="body2">
              Generating ID cards… {bulk.done} / {bulk.total}
            </Typography>
            <LinearProgress variant="determinate" value={(bulk.done / bulk.total) * 100} />
          </Stack>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!classId ? (
        <Alert severity="info" icon={<BadgeIcon />}>
          Select a class to list its students and print their ID cards.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          {isLoading && <LinearProgress />}
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Admission #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Roll #</TableCell>
                <TableCell align="right">ID Card</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.admission_number ?? "—"}</TableCell>
                  <TableCell>{s.full_name}</TableCell>
                  <TableCell>{classNameOf(s.class_grade_id)}</TableCell>
                  <TableCell>{sectionNameOf(s.section_id)}</TableCell>
                  <TableCell>{s.roll_number ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={busyId === s.id ? <CircularProgress size={14} /> : <DownloadIcon />}
                      disabled={busyId === s.id || !!bulk}
                      onClick={() => downloadOne(s)}
                    >
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No active students found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
