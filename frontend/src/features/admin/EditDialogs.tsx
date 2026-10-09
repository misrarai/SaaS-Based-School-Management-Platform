import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { updateTeacher, type Teacher } from "../../api/teachers";
import { updateStaff, type StaffMember } from "../../api/staff";
import { listFamilies, listFamilyStudents, updateFamily, type Family } from "../../api/families";
import { updateFeePlan, type FeePlan } from "../../api/fees";
import { updateStudent, type Student } from "../../api/students";
import { listClasses, listSections } from "../../api/classes";
import { apiErrorMessage } from "../../lib/apiError";

const blank = (v: string) => (v.trim() === "" ? null : v.trim());

function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  pending,
  error,
  children,
  maxWidth = "xs",
  submitLabel = "Save",
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  error: unknown;
  children: ReactNode;
  maxWidth?: "xs" | "sm" | "md";
  submitLabel?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth}>
      <DialogTitle>{title}</DialogTitle>
      <Box
        component="form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {children}
            {!!error && <Alert severity="error">{apiErrorMessage(error, "Could not save changes.")}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function EditTeacherDialog({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(teacher.full_name);
  const [phone, setPhone] = useState(teacher.phone_number ?? "");
  const [qualification, setQualification] = useState(teacher.qualification ?? "");
  const m = useMutation({
    mutationFn: () =>
      updateTeacher(teacher.id, { full_name: fullName.trim(), phone_number: blank(phone), qualification: blank(qualification) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
      onClose();
    },
  });
  return (
    <FormDialog open title="Edit teacher" onClose={onClose} onSubmit={() => m.mutate()} pending={m.isPending} error={m.error}>
      <TextField label="Email" value={teacher.email} disabled fullWidth helperText="Email can't be changed" />
      <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
      <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
      <TextField label="Qualification" value={qualification} onChange={(e) => setQualification(e.target.value)} fullWidth />
    </FormDialog>
  );
}

export function EditStaffDialog({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(staff.full_name);
  const [designation, setDesignation] = useState(staff.designation);
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(staff.whatsapp_number ?? "");
  const [salary, setSalary] = useState(staff.salary != null ? String(staff.salary) : "");
  const [hireDate, setHireDate] = useState(staff.hire_date ?? "");
  const [notes, setNotes] = useState(staff.notes ?? "");
  const m = useMutation({
    mutationFn: () =>
      updateStaff(staff.id, {
        full_name: fullName.trim(),
        designation: designation.trim(),
        phone: phone.trim() || undefined,
        whatsapp_number: whatsapp.trim() || undefined,
        salary: salary ? Number(salary) : undefined,
        hire_date: hireDate || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      onClose();
    },
  });
  return (
    <FormDialog
      open
      title={`Edit staff — ${staff.employee_code}`}
      onClose={onClose}
      onSubmit={() => m.mutate()}
      pending={m.isPending}
      error={m.error}
      maxWidth="sm"
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
        <TextField label="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)} required fullWidth />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
        <TextField label="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} fullWidth />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Monthly salary (PKR)"
          type="number"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          fullWidth
          slotProps={{ htmlInput: { min: 0 } }}
        />
        <TextField
          label="Hire date"
          type="date"
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
      <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} />
    </FormDialog>
  );
}

export function EditFamilyDialog({ family, onClose }: { family: Family; onClose: () => void }) {
  const qc = useQueryClient();
  const [familyName, setFamilyName] = useState(family.family_name);
  const [cnic, setCnic] = useState(family.cnic ?? "");
  const [phone, setPhone] = useState(family.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(family.whatsapp_number ?? "");
  const [notes, setNotes] = useState(family.notes ?? "");
  const m = useMutation({
    mutationFn: () =>
      updateFamily(family.id, {
        family_name: familyName.trim(),
        cnic: cnic.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp_number: whatsapp.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      onClose();
    },
  });
  return (
    <FormDialog
      open
      title={`Edit family — ${family.family_number}`}
      onClose={onClose}
      onSubmit={() => m.mutate()}
      pending={m.isPending}
      error={m.error}
    >
      <TextField label="Family name" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required fullWidth />
      <TextField label="CNIC" value={cnic} onChange={(e) => setCnic(e.target.value)} fullWidth />
      <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
      <TextField label="WhatsApp number" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} fullWidth />
      <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} />
    </FormDialog>
  );
}

export function FamilyDetailDialog({
  family,
  onClose,
  onEdit,
}: {
  family: Family;
  onClose: () => void;
  onEdit: () => void;
}) {
  const studentsQuery = useQuery({ queryKey: ["family-students", family.id], queryFn: () => listFamilyStudents(family.id) });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const className = (id: string | null) => classesQuery.data?.find((c) => c.id === id)?.name ?? "—";
  const students = studentsQuery.data ?? [];
  const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <Stack direction="row" spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {family.family_name}{" "}
        <Typography component="span" color="text.secondary">
          ({family.family_number})
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={0.75} sx={{ mb: 2 }}>
          <Row label="CNIC" value={family.cnic ?? "—"} />
          <Row label="Phone" value={family.phone ?? "—"} />
          <Row label="WhatsApp" value={family.whatsapp_number ?? "—"} />
          {family.notes && <Row label="Notes" value={family.notes} />}
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Students in this family ({students.length})
        </Typography>
        {studentsQuery.isLoading && <LinearProgress />}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Admission #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.admission_number ?? "—"}</TableCell>
                  <TableCell>{s.full_name}</TableCell>
                  <TableCell>{className(s.class_grade_id)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status} color={s.status === "active" ? "success" : "default"} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                </TableRow>
              ))}
              {!studentsQuery.isLoading && students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                    No students linked to this family.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onEdit}>Edit family</Button>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function EditFeePlanDialog({ plan, onClose }: { plan: FeePlan; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(plan.monthly_amount));
  const [name, setName] = useState(plan.name ?? "");
  const m = useMutation({
    mutationFn: () => updateFeePlan(plan.id, { monthly_amount: Number(amount), name: name.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-plans"] });
      qc.invalidateQueries({ queryKey: ["fees-plans"] });
      onClose();
    },
  });
  return (
    <FormDialog
      open
      title={`Edit fee plan — ${plan.academic_year}`}
      onClose={onClose}
      onSubmit={() => m.mutate()}
      pending={m.isPending}
      error={m.error}
    >
      <TextField label="Plan name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <TextField
        label="Monthly amount (PKR)"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 1, step: "any" } }}
      />
    </FormDialog>
  );
}

export function EditStudentDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const qc = useQueryClient();
  const d = student.admission_detail;
  const [fullName, setFullName] = useState(student.full_name);
  const [classId, setClassId] = useState(student.class_grade_id ?? "");
  const [sectionId, setSectionId] = useState(student.section_id ?? "");
  const [familyId, setFamilyId] = useState(student.family_id ?? "");
  const [rollNumber, setRollNumber] = useState(student.roll_number ?? "");
  const [fatherName, setFatherName] = useState(d?.father_name ?? "");
  const [fatherMobile, setFatherMobile] = useState(d?.father_mobile ?? "");
  const [whatsapp, setWhatsapp] = useState(d?.whatsapp_number ?? "");
  const [gender, setGender] = useState(d?.gender ?? "");
  const [address, setAddress] = useState(d?.current_address ?? "");
  const [discount, setDiscount] = useState(d?.discount_amount != null ? String(d.discount_amount) : "");

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const sectionsQuery = useQuery({ queryKey: ["sections", classId], queryFn: () => listSections(classId), enabled: !!classId });
  const familiesQuery = useQuery({ queryKey: ["families", ""], queryFn: () => listFamilies() });

  const m = useMutation({
    mutationFn: () =>
      updateStudent(student.id, {
        full_name: fullName.trim(),
        class_grade_id: classId || undefined,
        section_id: sectionId || undefined,
        family_id: familyId || undefined,
        roll_number: rollNumber.trim() || undefined,
        admission_detail: {
          father_name: blank(fatherName),
          father_mobile: blank(fatherMobile),
          whatsapp_number: blank(whatsapp),
          gender: blank(gender),
          current_address: blank(address),
          discount_amount: discount ? Number(discount) : null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
  });

  return (
    <FormDialog
      open
      title={`Edit student — ${student.admission_number ?? student.full_name}`}
      onClose={onClose}
      onSubmit={() => m.mutate()}
      pending={m.isPending}
      error={m.error}
      maxWidth="md"
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
        <TextField label="Email" value={student.email} disabled fullWidth />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          label="Class"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSectionId("");
          }}
          fullWidth
        >
          {(classesQuery.data ?? []).map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} fullWidth disabled={!classId}>
          <MenuItem value="">—</MenuItem>
          {(sectionsQuery.data ?? []).map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Roll #" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} fullWidth />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField select label="Family" value={familyId} onChange={(e) => setFamilyId(e.target.value)} fullWidth>
          <MenuItem value="">—</MenuItem>
          {(familiesQuery.data ?? []).map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {f.family_number} — {f.family_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Status"
          value={student.status}
          disabled
          fullWidth
          helperText="Use Withdraw / Reactivate on the register to change"
        />
      </Stack>
      <Divider textAlign="left">
        <Typography variant="caption" color="text.secondary">
          Admission details
        </Typography>
      </Divider>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField label="Father name" value={fatherName} onChange={(e) => setFatherName(e.target.value)} fullWidth />
        <TextField label="Father mobile" value={fatherMobile} onChange={(e) => setFatherMobile(e.target.value)} fullWidth />
        <TextField label="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} fullWidth />
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField select label="Gender" value={gender} onChange={(e) => setGender(e.target.value)} fullWidth>
          <MenuItem value="">—</MenuItem>
          {["Male", "Female", "Other"].map((g) => (
            <MenuItem key={g} value={g}>
              {g}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Fee discount (PKR)"
          type="number"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          fullWidth
          slotProps={{ htmlInput: { min: 0 } }}
        />
      </Stack>
      <TextField label="Current address" value={address} onChange={(e) => setAddress(e.target.value)} fullWidth multiline minRows={2} />
    </FormDialog>
  );
}
