import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PersonAddIcon from "@mui/icons-material/PersonAddOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  STAGES, createApplication, createVacancy, listApplications, listVacancies, updateApplication, updateVacancy,
  type Application, type Stage, type Vacancy,
} from "../../../api/recruitment";

const STAGE_COLOR: Record<Stage, "default" | "info" | "warning" | "primary" | "success" | "error"> = {
  applied: "default", shortlisted: "info", interview: "warning", offered: "primary", hired: "success", rejected: "error",
};

export function RecruitmentPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [vacDlg, setVacDlg] = useState(false);
  const [vac, setVac] = useState({ title: "", department: "", positions: "1" });
  const [appDlg, setAppDlg] = useState(false);
  const [app, setApp] = useState({ vacancy_id: "", candidate_name: "", email: "", phone: "", qualification: "", experience_years: "" });
  const [intFor, setIntFor] = useState<Application | null>(null);
  const [interview, setInterview] = useState({ interview_at: "", interviewer: "", interview_result: "pending" as "pending" | "pass" | "fail", interview_feedback: "" });
  const [error, setError] = useState<string | null>(null);

  const vacancies = useQuery({ queryKey: ["vacancies"], queryFn: () => listVacancies() });
  const applications = useQuery({ queryKey: ["applications"], queryFn: () => listApplications() });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["vacancies"] }); qc.invalidateQueries({ queryKey: ["applications"] }); };

  const addVac = useMutation({
    mutationFn: () => createVacancy({ title: vac.title, department: vac.department || undefined, positions: Number(vac.positions) || 1 }),
    onSuccess: () => { setVacDlg(false); setVac({ title: "", department: "", positions: "1" }); invalidate(); },
    onError: () => setError("Could not save vacancy."),
  });
  const closeVac = useMutation({ mutationFn: (id: string) => updateVacancy(id, { status: "closed" }), onSuccess: invalidate });
  const addApp = useMutation({
    mutationFn: () => createApplication({ vacancy_id: app.vacancy_id, candidate_name: app.candidate_name, email: app.email || undefined, phone: app.phone || undefined, qualification: app.qualification || undefined, experience_years: app.experience_years ? Number(app.experience_years) : undefined }),
    onSuccess: () => { setAppDlg(false); setApp({ vacancy_id: "", candidate_name: "", email: "", phone: "", qualification: "", experience_years: "" }); invalidate(); },
    onError: () => setError("Could not save application."),
  });
  const moveStage = useMutation({ mutationFn: ({ id, stage }: { id: string; stage: Stage }) => updateApplication(id, { stage }), onSuccess: invalidate });
  const saveInterview = useMutation({
    mutationFn: () => updateApplication(intFor!.id, { stage: "interview", interview_at: interview.interview_at ? new Date(interview.interview_at).toISOString() : null, interviewer: interview.interviewer, interview_result: interview.interview_result, interview_feedback: interview.interview_feedback }),
    onSuccess: () => { setIntFor(null); invalidate(); },
  });

  return (
    <AppShell title="HR — Recruitment" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="h4">Recruitment</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => { setError(null); setApp((a) => ({ ...a, vacancy_id: vacancies.data?.[0]?.id ?? "" })); setAppDlg(true); }}>Add Candidate</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setVacDlg(true); }}>New Vacancy</Button>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Job Vacancies (${vacancies.data?.length ?? 0})`} />
        <Tab label={`Applications (${applications.data?.length ?? 0})`} />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={darkTableHeadSx}><TableRow>
              <TableCell>Title</TableCell><TableCell>Department</TableCell><TableCell>Posted</TableCell>
              <TableCell align="right">Positions</TableCell><TableCell align="right">Applicants</TableCell><TableCell align="right">Hired</TableCell><TableCell>Status</TableCell><TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(vacancies.data?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={8} sx={{ color: "text.secondary" }}>No vacancies.</TableCell></TableRow>
              ) : vacancies.data!.map((v: Vacancy) => (
                <TableRow key={v.id} hover>
                  <TableCell>{v.title}</TableCell><TableCell>{v.department || "—"}</TableCell><TableCell>{v.posted_date}</TableCell>
                  <TableCell align="right">{v.positions}</TableCell><TableCell align="right">{v.application_count}</TableCell>
                  <TableCell align="right">{v.hired_count}</TableCell>
                  <TableCell><Chip size="small" color={v.status === "open" ? "success" : "default"} label={v.status} /></TableCell>
                  <TableCell align="right">{v.status === "open" && <Button size="small" onClick={() => closeVac.mutate(v.id)}>Close</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={darkTableHeadSx}><TableRow>
              <TableCell>Candidate</TableCell><TableCell>Vacancy</TableCell><TableCell>Experience</TableCell>
              <TableCell>Stage</TableCell><TableCell>Interview</TableCell><TableCell align="right" />
            </TableRow></TableHead>
            <TableBody>
              {(applications.data?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No applications.</TableCell></TableRow>
              ) : applications.data!.map((a: Application) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.candidate_name}{a.email && <div style={{ color: "#667085", fontSize: 12 }}>{a.email}</div>}</TableCell>
                  <TableCell>{a.vacancy_title}</TableCell>
                  <TableCell>{a.experience_years != null ? `${a.experience_years} yr` : "—"}</TableCell>
                  <TableCell>
                    <TextField select size="small" variant="standard" value={a.stage} onChange={(e) => moveStage.mutate({ id: a.id, stage: e.target.value as Stage })} slotProps={{ input: { disableUnderline: true } }}>
                      {STAGES.map((s) => <MenuItem key={s} value={s}><Chip size="small" color={STAGE_COLOR[s]} label={s} /></MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    {a.interview_at ? `${new Date(a.interview_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}${a.interview_result && a.interview_result !== "pending" ? ` · ${a.interview_result}` : ""}` : "—"}
                  </TableCell>
                  <TableCell align="right"><Button size="small" onClick={() => { setInterview({ interview_at: a.interview_at ? a.interview_at.slice(0, 16) : "", interviewer: a.interviewer ?? "", interview_result: (a.interview_result ?? "pending") as "pending" | "pass" | "fail", interview_feedback: a.interview_feedback ?? "" }); setIntFor(a); }}>Interview</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={vacDlg} onClose={() => setVacDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Vacancy</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField size="small" label="Title" value={vac.title} onChange={(e) => setVac((v) => ({ ...v, title: e.target.value }))} />
            <TextField size="small" label="Department" value={vac.department} onChange={(e) => setVac((v) => ({ ...v, department: e.target.value }))} />
            <TextField size="small" type="number" label="Positions" value={vac.positions} onChange={(e) => setVac((v) => ({ ...v, positions: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setVacDlg(false)}>Cancel</Button><Button variant="contained" onClick={() => addVac.mutate()} disabled={!vac.title.trim() || addVac.isPending}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={appDlg} onClose={() => setAppDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Candidate</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select size="small" label="Vacancy" value={app.vacancy_id} onChange={(e) => setApp((a) => ({ ...a, vacancy_id: e.target.value }))}>
              {(vacancies.data ?? []).filter((v) => v.status === "open").map((v) => <MenuItem key={v.id} value={v.id}>{v.title}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Candidate name" value={app.candidate_name} onChange={(e) => setApp((a) => ({ ...a, candidate_name: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Email" fullWidth value={app.email} onChange={(e) => setApp((a) => ({ ...a, email: e.target.value }))} />
              <TextField size="small" label="Phone" fullWidth value={app.phone} onChange={(e) => setApp((a) => ({ ...a, phone: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="Qualification" fullWidth value={app.qualification} onChange={(e) => setApp((a) => ({ ...a, qualification: e.target.value }))} />
              <TextField size="small" type="number" label="Experience (yr)" sx={{ width: 140 }} value={app.experience_years} onChange={(e) => setApp((a) => ({ ...a, experience_years: e.target.value }))} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setAppDlg(false)}>Cancel</Button><Button variant="contained" onClick={() => addApp.mutate()} disabled={!app.vacancy_id || !app.candidate_name.trim() || addApp.isPending}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={!!intFor} onClose={() => setIntFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>Interview — {intFor?.candidate_name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField size="small" type="datetime-local" label="When" slotProps={{ inputLabel: { shrink: true } }} value={interview.interview_at} onChange={(e) => setInterview((i) => ({ ...i, interview_at: e.target.value }))} />
            <TextField size="small" label="Interviewer" value={interview.interviewer} onChange={(e) => setInterview((i) => ({ ...i, interviewer: e.target.value }))} />
            <TextField select size="small" label="Result" value={interview.interview_result} onChange={(e) => setInterview((i) => ({ ...i, interview_result: e.target.value as "pending" | "pass" | "fail" }))}>
              <MenuItem value="pending">Pending</MenuItem><MenuItem value="pass">Pass</MenuItem><MenuItem value="fail">Fail</MenuItem>
            </TextField>
            <TextField size="small" label="Feedback" multiline minRows={2} value={interview.interview_feedback} onChange={(e) => setInterview((i) => ({ ...i, interview_feedback: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setIntFor(null)}>Cancel</Button><Button variant="contained" onClick={() => saveInterview.mutate()} disabled={saveInterview.isPending}>Save</Button></DialogActions>
      </Dialog>
    </AppShell>
  );
}
