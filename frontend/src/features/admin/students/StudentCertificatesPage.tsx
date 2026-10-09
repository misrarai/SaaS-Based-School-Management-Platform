import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { fetchCertificatePdf, type Student } from "../../../api/students";
import { apiErrorMessage, saveBlob } from "../../../lib/apiError";
import { useClassSectionStudents } from "./ClassSectionFilter";

const CERTIFICATE_TYPES: { key: string; label: string; text: string }[] = [
  { key: "merit", label: "Academic Merit", text: "in recognition of outstanding academic performance and dedication" },
  { key: "character", label: "Character Certificate", text: "for exemplary conduct, discipline and good character during studies at this school" },
  { key: "participation", label: "Participation", text: "for active participation in co-curricular activities" },
  { key: "attendance", label: "Perfect Attendance", text: "for achieving perfect attendance throughout the session" },
  { key: "sports", label: "Sports Achievement", text: "for outstanding achievement in sports" },
  { key: "custom", label: "Custom…", text: "" },
];

export function StudentCertificatesPage() {
  const { classId, students, isLoading, filters, classNameOf } = useClassSectionStudents();
  const [selected, setSelected] = useState<Student | null>(null);
  const [typeKey, setTypeKey] = useState(CERTIFICATE_TYPES[0].key);
  const [text, setText] = useState(CERTIFICATE_TYPES[0].text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(mode: "preview" | "download") {
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await fetchCertificatePdf(selected.id, text.trim() || undefined);
      if (mode === "download") {
        saveBlob(blob, `certificate-${selected.full_name.replace(/[^\w-]+/g, "_")}.pdf`);
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Could not generate certificate."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Student Certificates" navItems={adminNavItems}>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        {filters}
      </Paper>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Typography variant="subtitle2" sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
              Students {classId ? `(${students.length})` : ""}
            </Typography>
            {isLoading && <LinearProgress />}
            {!classId ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Select a class first.
              </Typography>
            ) : (
              <List dense sx={{ maxHeight: 480, overflowY: "auto" }}>
                {students.map((s) => (
                  <ListItemButton key={s.id} selected={selected?.id === s.id} onClick={() => setSelected(s)}>
                    <ListItemText
                      primary={s.full_name}
                      secondary={`${s.admission_number ?? "—"} · ${classNameOf(s.class_grade_id)}`}
                    />
                  </ListItemButton>
                ))}
                {!isLoading && students.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    No active students found.
                  </Typography>
                )}
              </List>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              Certificate
            </Typography>
            {!selected ? (
              <Alert severity="info">Choose a student from the list to issue a certificate.</Alert>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Awarded to
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {selected.full_name}
                  </Typography>
                </Box>
                <TextField
                  select
                  label="Certificate type"
                  value={typeKey}
                  onChange={(e) => {
                    const t = CERTIFICATE_TYPES.find((c) => c.key === e.target.value)!;
                    setTypeKey(t.key);
                    setText(t.text);
                  }}
                  size="small"
                >
                  {CERTIFICATE_TYPES.map((t) => (
                    <MenuItem key={t.key} value={t.key}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Achievement text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  multiline
                  minRows={3}
                  helperText="Printed after the student's name on the certificate"
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" startIcon={<VisibilityIcon />} disabled={busy} onClick={() => generate("preview")}>
                    Preview
                  </Button>
                  <Button variant="contained" startIcon={<DownloadIcon />} disabled={busy} onClick={() => generate("download")}>
                    {busy ? "Generating…" : "Download PDF"}
                  </Button>
                </Stack>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </AppShell>
  );
}
