import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { StudentsActionBar } from "./StudentsActionBar";
import { listClasses, listSections } from "../../../api/classes";
import { listFamilies, getNextFamilyNumber, type Family } from "../../../api/families";
import { createStudent, getNextAdmissionNumber } from "../../../api/students";
import { uploadImage, resolveUploadUrl } from "../../../api/uploads";
import { createInvoice } from "../../../api/fees";

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const CATEGORY_OPTIONS = ["Regular", "Scholarship", "Staff Ward", "Sibling Discount"];
const OCCUPATION_OPTIONS = ["Business", "Engineer", "Doctor", "Teacher", "Government Employee", "Farmer", "Other"];
const RELATION_OPTIONS = ["Father", "Mother", "Uncle", "Aunt", "Grandfather", "Grandmother", "Other"];
const UTM_SOURCE_OPTIONS = ["Walk-in", "Referral", "Social Media", "Website", "Advertisement"];
const REGION_OPTIONS = ["Punjab", "Sindh", "KPK", "Balochistan", "Islamabad", "Azad Kashmir", "Gilgit-Baltistan"];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELIGION_OPTIONS = ["Islam", "Christianity", "Hinduism", "Sikhism", "Other"];
const NATIONALITY_OPTIONS = ["Pakistani", "Other"];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0e3550", mb: 2 }}>
      {children}
    </Typography>
  );
}

export function RegisterStudentPage() {
  const navigate = useNavigate();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const nextAdmissionNumberQuery = useQuery({ queryKey: ["next-admission-number"], queryFn: getNextAdmissionNumber });
  const nextFamilyNumberQuery = useQuery({ queryKey: ["next-family-number"], queryFn: getNextFamilyNumber });

  const [createFeeVoucher, setCreateFeeVoucher] = useState(false);
  const [createAdmissionVoucher, setCreateAdmissionVoucher] = useState(false);
  const [feeVoucherAmount, setFeeVoucherAmount] = useState("");
  const [admissionVoucherAmount, setAdmissionVoucherAmount] = useState("");

  // Academic data
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [classGradeId, setClassGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [admissionDate, setAdmissionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [discountAmount, setDiscountAmount] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    if (nextAdmissionNumberQuery.data && !admissionNumber) setAdmissionNumber(nextAdmissionNumberQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextAdmissionNumberQuery.data]);

  const sectionsQuery = useQuery({
    queryKey: ["sections", classGradeId],
    queryFn: () => listSections(classGradeId),
    enabled: !!classGradeId,
  });

  // Student & father information
  const [familySearch, setFamilySearch] = useState("");
  const familiesQuery = useQuery({
    queryKey: ["families", familySearch],
    queryFn: () => listFamilies(familySearch || undefined),
  });
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [fatherCnic, setFatherCnic] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherMobile, setFatherMobile] = useState("");
  const [fatherQualification, setFatherQualification] = useState("");
  const [fatherOccupation, setFatherOccupation] = useState<string | null>(null);
  const [guardianMobile, setGuardianMobile] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [studentCnic, setStudentCnic] = useState("");
  const [caste, setCaste] = useState("");
  const [gender, setGender] = useState("Male");
  const [currentAddress, setCurrentAddress] = useState("");

  // Other details (collapsible)
  const [otherDetailsOpen, setOtherDetailsOpen] = useState(false);
  const [motherName, setMotherName] = useState("");
  const [motherCnic, setMotherCnic] = useState("");
  const [motherMobile, setMotherMobile] = useState("");
  const [motherQualification, setMotherQualification] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState<string | null>(null);
  const [emergencyRelation, setEmergencyRelation] = useState<string | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyMobile, setEmergencyMobile] = useState("");
  const [emergencyAddress, setEmergencyAddress] = useState("");
  const [utmSource, setUtmSource] = useState<string | null>(null);
  const [admissionFormNumber, setAdmissionFormNumber] = useState("");
  const [registerSerialNo, setRegisterSerialNo] = useState("");
  const [previousClass, setPreviousClass] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [studentMobile, setStudentMobile] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [religion, setReligion] = useState<string | null>(null);
  const [nationality, setNationality] = useState<string | null>("Pakistani");

  const [error, setError] = useState<string | null>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadImage(file);
      setPhotoUrl(url);
    } catch {
      setError("Could not upload photo.");
    } finally {
      setPhotoUploading(false);
    }
  }

  const registerStudent = useMutation({
    mutationFn: async () => {
      const student = await createStudent({
        full_name: studentName,
        email: studentEmail,
        password: studentPassword,
        class_grade_id: classGradeId,
        section_id: sectionId || undefined,
        family_id: selectedFamily?.id,
        admission_date: admissionDate || undefined,
        date_of_birth: dateOfBirth || undefined,
        guardian_name: guardianName || undefined,
        admission_detail: {
          discount_amount: discountAmount ? Number(discountAmount) : undefined,
          photo_url: photoUrl ?? undefined,
          father_name: fatherName || undefined,
          father_cnic: fatherCnic || undefined,
          father_mobile: fatherMobile || undefined,
          father_qualification: fatherQualification || undefined,
          father_occupation: fatherOccupation ?? undefined,
          guardian_mobile: guardianMobile || undefined,
          whatsapp_number: whatsappNumber || undefined,
          category: category ?? undefined,
          student_cnic: studentCnic || undefined,
          caste: caste || undefined,
          gender: gender || undefined,
          current_address: currentAddress || undefined,
          mother_name: motherName || undefined,
          mother_cnic: motherCnic || undefined,
          mother_mobile: motherMobile || undefined,
          mother_qualification: motherQualification || undefined,
          guardian_relation: guardianRelation ?? undefined,
          emergency_relation: emergencyRelation ?? undefined,
          emergency_contact_name: emergencyContactName || undefined,
          emergency_phone: emergencyPhone || undefined,
          emergency_mobile: emergencyMobile || undefined,
          emergency_address: emergencyAddress || undefined,
          utm_source: utmSource ?? undefined,
          admission_form_number: admissionFormNumber || undefined,
          register_serial_no: registerSerialNo || undefined,
          previous_class: previousClass || undefined,
          previous_school: previousSchool || undefined,
          region: region ?? undefined,
          blood_group: bloodGroup ?? undefined,
          student_mobile: studentMobile || undefined,
          birth_place: birthPlace || undefined,
          religion: religion ?? undefined,
          nationality: nationality ?? undefined,
        },
      });

      // Voucher creation is best-effort: the student record is already saved at this point,
      // so a voucher failure (e.g. bad amount) shouldn't block registration — admin can add
      // the invoice manually from the Invoices page afterward.
      const dueDate = admissionDate || new Date().toISOString().slice(0, 10);
      if (createAdmissionVoucher && admissionVoucherAmount) {
        try {
          await createInvoice({
            student_id: student.id,
            invoice_type: "admission",
            amount_due: Number(admissionVoucherAmount),
            due_date: dueDate,
          });
        } catch {
          // swallow — see comment above
        }
      }
      if (createFeeVoucher && feeVoucherAmount) {
        try {
          await createInvoice({
            student_id: student.id,
            invoice_type: "tuition",
            amount_due: Number(feeVoucherAmount),
            due_date: dueDate,
          });
        } catch {
          // swallow — see comment above
        }
      }

      return student;
    },
    onSuccess: () => navigate("/admin/students?status=all"),
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Could not register student — please check the required fields.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    registerStudent.mutate();
  }

  return (
    <AppShell title="Students" navItems={adminNavItems}>
      <Stack sx={{ mb: 2 }}>
        <StudentsActionBar active="add" />
      </Stack>

      <Box component="form" onSubmit={handleSubmit}>
        <Paper variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 2 }}>
            <FormControlLabel
              control={<Checkbox checked={createFeeVoucher} onChange={(e) => setCreateFeeVoucher(e.target.checked)} />}
              label="Create fee voucher?"
            />
            {createFeeVoucher && (
              <TextField
                size="small"
                label="Monthly fee (PKR)"
                type="number"
                value={feeVoucherAmount}
                onChange={(e) => setFeeVoucherAmount(e.target.value)}
                required
                sx={{ width: 160 }}
              />
            )}
            <FormControlLabel
              control={
                <Checkbox checked={createAdmissionVoucher} onChange={(e) => setCreateAdmissionVoucher(e.target.checked)} />
              }
              label="Create admission voucher?"
            />
            {createAdmissionVoucher && (
              <TextField
                size="small"
                label="Admission fee (PKR)"
                type="number"
                value={admissionVoucherAmount}
                onChange={(e) => setAdmissionVoucherAmount(e.target.value)}
                required
                sx={{ width: 160 }}
              />
            )}
          </Stack>

          <SectionHeading>ACADEMIC DATA</SectionHeading>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label={`Admission/GR No${nextAdmissionNumberQuery.data ? ` (Last:${nextAdmissionNumberQuery.data})` : ""}`}
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                helperText="Auto-suggested — the final number is assigned on save"
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl required fullWidth>
                <InputLabel id="reg-class-label">Class</InputLabel>
                <Select
                  labelId="reg-class-label"
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
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth disabled={!classGradeId}>
                <InputLabel id="reg-section-label">Section (optional)</InputLabel>
                <Select
                  labelId="reg-section-label"
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
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Admission Date"
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Discount (if any)"
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 5 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Avatar src={photoUrl ? resolveUploadUrl(photoUrl) : undefined} sx={{ width: 56, height: 56 }} />
                <Button component="label" variant="outlined" startIcon={<PhotoCameraIcon />} disabled={photoUploading}>
                  {photoUploading ? "Uploading…" : "Upload Student Picture"}
                  <input type="file" accept="image/*" hidden onChange={handlePhotoChange} />
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 2 }}>
          <SectionHeading>STUDENT &amp; FATHER INFORMATION</SectionHeading>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Autocomplete
                options={familiesQuery.data ?? []}
                getOptionLabel={(f) => `${f.family_number} — ${f.family_name}`}
                value={selectedFamily}
                onChange={(_, value) => setSelectedFamily(value)}
                onInputChange={(_, value) => setFamilySearch(value)}
                renderInput={(params) => <TextField {...params} label="Select Family" placeholder="Search a family by name or number" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Father C.N.I.C #" value={fatherCnic} onChange={(e) => setFatherCnic(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="Family No"
                value={selectedFamily ? selectedFamily.family_number : nextFamilyNumberQuery.data ?? ""}
                helperText={selectedFamily ? "Existing family selected" : "A new family will be created with this number"}
                slotProps={{ input: { readOnly: true } }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Student Name" value={studentName} onChange={(e) => setStudentName(e.target.value)} required fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Student Email (for login)" type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} required fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="Temporary Password"
                type="password"
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                required
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Father Name" value={fatherName} onChange={(e) => setFatherName(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Father Mobile" value={fatherMobile} onChange={(e) => setFatherMobile(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Father Qualification" value={fatherQualification} onChange={(e) => setFatherQualification(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Autocomplete
                freeSolo
                options={OCCUPATION_OPTIONS}
                value={fatherOccupation}
                onChange={(_, value) => setFatherOccupation(value)}
                onInputChange={(_, value) => setFatherOccupation(value)}
                renderInput={(params) => <TextField {...params} label="Father Occupation" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Guardian Mobile" value={guardianMobile} onChange={(e) => setGuardianMobile(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="WhatsApp Number" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Autocomplete
                freeSolo
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={(_, value) => setCategory(value)}
                onInputChange={(_, value) => setCategory(value)}
                renderInput={(params) => <TextField {...params} label="Category" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label="Date Of Birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Student C.N.I.C #" value={studentCnic} onChange={(e) => setStudentCnic(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField label="Caste / Race" value={caste} onChange={(e) => setCaste(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel id="gender-label">Gender</InputLabel>
                <Select labelId="gender-label" label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                  {GENDER_OPTIONS.map((g) => (
                    <MenuItem key={g} value={g}>
                      {g}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Current Address" value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} fullWidth />
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", mb: 2 }}>
          <Box
            onClick={() => setOtherDetailsOpen((v) => !v)}
            sx={{
              bgcolor: "#5c4033",
              color: "#fff",
              px: 2,
              py: 1.2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <Typography sx={{ fontWeight: 600 }}>Student Other Details</Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Typography variant="body2">Toggle Details</Typography>
              {otherDetailsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </Stack>
          </Box>
          <Collapse in={otherDetailsOpen} timeout="auto" unmountOnExit>
            <Box sx={{ p: 3 }}>
              <SectionHeading>MOTHER INFORMATION</SectionHeading>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Mother Name" value={motherName} onChange={(e) => setMotherName(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Mother C.N.I.C #" value={motherCnic} onChange={(e) => setMotherCnic(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Mother Mobile" value={motherMobile} onChange={(e) => setMotherMobile(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label="Mother Qualification"
                    value={motherQualification}
                    onChange={(e) => setMotherQualification(e.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />
              <SectionHeading>GUARDIAN INFORMATION</SectionHeading>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <TextField label="Guardian Name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Autocomplete
                    freeSolo
                    options={RELATION_OPTIONS}
                    value={guardianRelation}
                    onChange={(_, value) => setGuardianRelation(value)}
                    onInputChange={(_, value) => setGuardianRelation(value)}
                    renderInput={(params) => <TextField {...params} label="Relation" />}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />
              <SectionHeading>EMERGENCY CONTACT INFORMATION</SectionHeading>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Autocomplete
                    freeSolo
                    options={RELATION_OPTIONS}
                    value={emergencyRelation}
                    onChange={(_, value) => setEmergencyRelation(value)}
                    onInputChange={(_, value) => setEmergencyRelation(value)}
                    renderInput={(params) => <TextField {...params} label="Relation" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Contact Name" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Phone (Landline)" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Mobile Number" value={emergencyMobile} onChange={(e) => setEmergencyMobile(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField label="Address" value={emergencyAddress} onChange={(e) => setEmergencyAddress(e.target.value)} fullWidth />
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />
              <SectionHeading>OTHER INFORMATION</SectionHeading>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Autocomplete
                    freeSolo
                    options={UTM_SOURCE_OPTIONS}
                    value={utmSource}
                    onChange={(_, value) => setUtmSource(value)}
                    onInputChange={(_, value) => setUtmSource(value)}
                    renderInput={(params) => <TextField {...params} label="UTM Source" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Admission Form Number" value={admissionFormNumber} onChange={(e) => setAdmissionFormNumber(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Register Serial No" value={registerSerialNo} onChange={(e) => setRegisterSerialNo(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Previous Class" value={previousClass} onChange={(e) => setPreviousClass(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Previous School" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Autocomplete
                    freeSolo
                    options={REGION_OPTIONS}
                    value={region}
                    onChange={(_, value) => setRegion(value)}
                    onInputChange={(_, value) => setRegion(value)}
                    renderInput={(params) => <TextField {...params} label="Region" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Autocomplete
                    options={BLOOD_GROUP_OPTIONS}
                    value={bloodGroup}
                    onChange={(_, value) => setBloodGroup(value)}
                    renderInput={(params) => <TextField {...params} label="Blood Group" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Student Mobile" value={studentMobile} onChange={(e) => setStudentMobile(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField label="Birth Place" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Autocomplete
                    freeSolo
                    options={RELIGION_OPTIONS}
                    value={religion}
                    onChange={(_, value) => setReligion(value)}
                    onInputChange={(_, value) => setReligion(value)}
                    renderInput={(params) => <TextField {...params} label="Religion" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Autocomplete
                    freeSolo
                    options={NATIONALITY_OPTIONS}
                    value={nationality}
                    onChange={(_, value) => setNationality(value)}
                    onInputChange={(_, value) => setNationality(value)}
                    renderInput={(params) => <TextField {...params} label="Nationality" />}
                  />
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={() => navigate("/admin/students?status=all")}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={registerStudent.isPending || !classGradeId}>
            {registerStudent.isPending ? "Saving…" : "Register Student"}
          </Button>
        </Stack>
      </Box>
    </AppShell>
  );
}
