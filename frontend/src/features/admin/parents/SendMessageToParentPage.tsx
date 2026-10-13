import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import SendIcon from "@mui/icons-material/SendOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { listStudents, type Student } from "../../../api/students";
import { listClasses } from "../../../api/classes";
import { apiClient } from "../../../api/client";

interface SendEmailPayload {
  student_id: string;
  subject: string;
  body: string;
}

function sendEmailToParent(payload: SendEmailPayload) {
  return apiClient.post("/communication/messages/send-to-parent", payload).then((r) => r.data);
}

function getParentPhone(student: Student) {
  return (student.admission_detail as any)?.contact_phone
    || (student.admission_detail as any)?.guardian_phone
    || null;
}

function makeWhatsAppLink(phone: string, message: string) {
  const clean = phone.replace(/[^0-9+]/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${clean}?text=${encoded}`;
}

export function SendMessageToParentPage() {
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const students = useQuery({
    queryKey: ["students", classId],
    queryFn: () => listStudents({ classGradeId: classId || undefined, status: "active" }),
    enabled: true,
  });

  const selectedStudent = (students.data ?? []).find((s) => s.id === studentId);
  const parentPhone = selectedStudent ? getParentPhone(selectedStudent) : null;
  const parentEmail = selectedStudent?.admission_detail
    ? (selectedStudent.admission_detail as any).parent_email || selectedStudent.email
    : selectedStudent?.email;

  const whatsAppText = subject
    ? `*${subject}*\n\n${body}\n\n— School Management`
    : body;

  const sendEmail = useMutation({
    mutationFn: () => sendEmailToParent({ student_id: studentId, subject, body }),
    onSuccess: () => {
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    },
  });

  const canSend = !!studentId && !!subject.trim() && !!body.trim();

  return (
    <AppShell navItems={adminNavItems} title="Message to Parent">
      <Stack spacing={3} sx={{ maxWidth: 720 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SendIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Send Message to Parent
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Select a student, write your message, then send it via Email or share via WhatsApp.
        </Typography>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2.5}>
              {/* Class filter */}
              <FormControl size="small" fullWidth>
                <InputLabel>Filter by Class (optional)</InputLabel>
                <Select
                  value={classId}
                  label="Filter by Class (optional)"
                  onChange={(e) => { setClassId(e.target.value); setStudentId(""); }}
                >
                  <MenuItem value="">All Classes</MenuItem>
                  {(classes.data ?? []).map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Student picker */}
              <FormControl size="small" fullWidth>
                <InputLabel>Select Student *</InputLabel>
                <Select
                  value={studentId}
                  label="Select Student *"
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <MenuItem value="">— choose student —</MenuItem>
                  {(students.data ?? []).map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.full_name} {s.class_grade ? `· ${s.class_grade}` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Parent info preview */}
              {selectedStudent && (
                <Box
                  sx={{
                    bgcolor: "action.hover",
                    borderRadius: 1.5,
                    p: 1.5,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: "primary.main" }}>
                      {selectedStudent.full_name[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {selectedStudent.full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Guardian: {selectedStudent.guardian_name || "—"}
                        {parentEmail ? ` · ${parentEmail}` : ""}
                        {parentPhone ? ` · 📱 ${parentPhone}` : ""}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              )}

              <Divider />

              {/* Message form */}
              <TextField
                label="Subject *"
                size="small"
                fullWidth
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Progress Report — October 2026"
              />

              <TextField
                label="Message *"
                fullWidth
                multiline
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={`Dear Parent,\n\nWe wanted to update you on your child's progress...\n\nRegards,\nSchool Management`}
              />

              {/* Quick message templates */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                  Quick templates:
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {[
                    { label: "Progress Update", subject: "Monthly Progress Report", body: `Dear Parent,\n\nI hope this message finds you well. I wanted to share your child's progress for this month:\n\n📚 Academic Performance: [add details]\n✅ Attendance: [add details]\n📝 Assignments: [add details]\n\nPlease feel free to contact us if you have any questions.\n\nRegards,\nSchool Management` },
                    { label: "Attendance Issue", subject: "Attendance Notice", body: `Dear Parent,\n\nWe would like to inform you that your child's attendance has been below the required level.\n\nPlease ensure your child attends school regularly. If there is any issue, please contact us.\n\nRegards,\nSchool Management` },
                    { label: "Fee Reminder", subject: "Fee Payment Reminder", body: `Dear Parent,\n\nThis is a friendly reminder that your child's fee for this month is due.\n\nPlease ensure timely payment to avoid any inconvenience.\n\nRegards,\nSchool Management` },
                    { label: "Exam Notice", subject: "Upcoming Examination", body: `Dear Parent,\n\nWe would like to inform you that examinations are approaching. Please ensure your child prepares well.\n\nExam Schedule will be shared shortly.\n\nRegards,\nSchool Management` },
                  ].map((t) => (
                    <Chip
                      key={t.label}
                      label={t.label}
                      size="small"
                      clickable
                      onClick={() => { setSubject(t.subject); setBody(t.body); }}
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>

              {emailSent && (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  Email sent successfully!
                </Alert>
              )}

              {sendEmail.isError && (
                <Alert severity="error">
                  Failed to send email. Please try again.
                </Alert>
              )}

              {/* Action buttons */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {/* Email button */}
                <Button
                  variant="contained"
                  startIcon={<EmailIcon />}
                  disabled={!canSend || sendEmail.isPending}
                  onClick={() => sendEmail.mutate()}
                  sx={{ flex: 1 }}
                >
                  {sendEmail.isPending ? "Sending…" : "Send via Email"}
                </Button>

                {/* WhatsApp button */}
                <Button
                  variant="contained"
                  startIcon={<WhatsAppIcon />}
                  disabled={!canSend}
                  onClick={() => {
                    const phone = parentPhone || "923001234567"; // fallback
                    window.open(makeWhatsAppLink(phone, whatsAppText), "_blank");
                  }}
                  sx={{
                    flex: 1,
                    bgcolor: "#25D366",
                    "&:hover": { bgcolor: "#1ebe57" },
                  }}
                >
                  Share via WhatsApp
                </Button>
              </Stack>

              {!parentPhone && selectedStudent && (
                <Typography variant="caption" color="text.secondary">
                  💡 WhatsApp button will open WhatsApp. If parent phone is not saved, enter the number manually in WhatsApp.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}
