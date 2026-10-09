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
import EmailIcon from "@mui/icons-material/EmailOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { emailReportCard, fetchReportCardPdf, type Student } from "../../../api/students";
import { apiErrorMessage, saveBlob } from "../../../lib/apiError";
import { useClassSectionStudents } from "./ClassSectionFilter";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function StudentReportsPage() {
  const { classId, students, isLoading, filters, classNameOf } = useClassSectionStudents();
  const now = new Date();
  const [selected, setSelected] = useState<Student | null>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [toEmail, setToEmail] = useState("");
  const [busy, setBusy] = useState<"pdf" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 4 + i);

  async function getPdf(mode: "preview" | "download") {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    setBusy("pdf");
    try {
      const blob = await fetchReportCardPdf(selected.id, month, year);
      if (mode === "download") {
        saveBlob(blob, `report-card-${selected.full_name.replace(/[^\w-]+/g, "_")}-${year}-${String(month).padStart(2, "0")}.pdf`);
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Could not generate report card."));
    } finally {
      setBusy(null);
    }
  }

  async function sendEmail() {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    setBusy("email");
    try {
      const logs = await emailReportCard(selected.id, {
        period_month: month,
        period_year: year,
        to_email: toEmail.trim() || undefined,
      });
      const sent = logs.filter((l) => l.status === "sent").length;
      if (logs.length === 0) setError("No recipient email found — link a parent with an email or enter one above.");
      else if (sent === 0) setError(logs[0]?.detail || "Email could not be delivered.");
      else
        setSuccess(
          `Report card emailed to ${logs
            .filter((l) => l.status === "sent")
            .map((l) => l.recipient_email)
            .filter(Boolean)
            .join(", ") || `${sent} recipient(s)`}.`,
        );
    } catch (err) {
      setError(apiErrorMessage(err, "Could not email report card."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Student Reports" navItems={adminNavItems}>
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
                    <ListItemText primary={s.full_name} secondary={`${s.admission_number ?? "—"} · ${classNameOf(s.class_grade_id)}`} />
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
              Monthly report card
            </Typography>
            {!selected ? (
              <Alert severity="info">Choose a student to generate or email their report card.</Alert>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Student
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {selected.full_name}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                  <TextField select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} size="small" sx={{ minWidth: 160 }}>
                    {MONTHS.map((m, i) => (
                      <MenuItem key={m} value={i + 1}>
                        {m}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} size="small" sx={{ minWidth: 120 }}>
                    {years.map((y) => (
                      <MenuItem key={y} value={y}>
                        {y}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Button variant="outlined" startIcon={<VisibilityIcon />} disabled={!!busy} onClick={() => getPdf("preview")}>
                    Preview
                  </Button>
                  <Button variant="contained" startIcon={<DownloadIcon />} disabled={!!busy} onClick={() => getPdf("download")}>
                    {busy === "pdf" ? "Generating…" : "Download PDF"}
                  </Button>
                </Stack>
                <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Email to parents
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      label="Override recipient email (optional)"
                      type="email"
                      value={toEmail}
                      onChange={(e) => setToEmail(e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                      helperText="Leave empty to send to every linked parent"
                    />
                    <Button variant="contained" color="secondary" startIcon={<EmailIcon />} disabled={!!busy} onClick={sendEmail} sx={{ alignSelf: "flex-start" }}>
                      {busy === "email" ? "Sending…" : "Send email"}
                    </Button>
                  </Stack>
                </Box>
                {error && <Alert severity="error">{error}</Alert>}
                {success && <Alert severity="success">{success}</Alert>}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </AppShell>
  );
}
