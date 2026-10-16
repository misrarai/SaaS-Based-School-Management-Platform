import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  createPromotionRule, deletePromotionRule, executePromotion, listCandidates, listPromotionRules,
} from "../../../api/promotion";
import { listClasses } from "../../../api/classes";

export function PromotionPage() {
  const qc = useQueryClient();
  const [ruleDlg, setRuleDlg] = useState(false);
  const [rule, setRule] = useState({ source_class_id: "", target_class_id: "", pass_mark: "40" });
  const [error, setError] = useState<string | null>(null);
  // run promotion
  const [sourceClass, setSourceClass] = useState("");
  const [targetClass, setTargetClass] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const classes = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const rules = useQuery({ queryKey: ["promotion-rules"], queryFn: listPromotionRules });
  const candidates = useQuery({ queryKey: ["promotion-candidates", sourceClass], queryFn: () => listCandidates(sourceClass), enabled: !!sourceClass });

  const addRule = useMutation({
    mutationFn: () => createPromotionRule({ source_class_id: rule.source_class_id, target_class_id: rule.target_class_id || null, pass_mark: rule.pass_mark ? Number(rule.pass_mark) : null }),
    onSuccess: () => { setRuleDlg(false); qc.invalidateQueries({ queryKey: ["promotion-rules"] }); },
    onError: (e: unknown) => setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not save rule."),
  });
  const delRule = useMutation({ mutationFn: (id: string) => deletePromotionRule(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["promotion-rules"] }) });
  const run = useMutation({
    mutationFn: () => executePromotion({ source_class_id: sourceClass, target_class_id: targetClass || null, student_ids: [...selected] }),
    onSuccess: (r) => {
      setNotice(`Promoted ${r.promoted}${r.graduated ? `, graduated ${r.graduated}` : ""} student(s).`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["promotion-candidates"] });
    },
  });

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = (candidates.data?.length ?? 0) > 0 && selected.size === candidates.data!.length;

  return (
    <AppShell title="Settings — Student Promotion" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>Student Promotion</Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="h6">Promotion Rules</Typography>
          <Button startIcon={<AddIcon />} onClick={() => { setError(null); setRule({ source_class_id: "", target_class_id: "", pass_mark: "40" }); setRuleDlg(true); }}>Add Rule</Button>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}><TableRow><TableCell>Source class</TableCell><TableCell>Promotes to</TableCell><TableCell align="right">Pass mark</TableCell><TableCell align="right" /></TableRow></TableHead>
            <TableBody>
              {(rules.data?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>No rules. Rules are guidance for the promotion run below.</TableCell></TableRow>
              ) : rules.data!.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.source_class_name}</TableCell>
                  <TableCell>{r.target_class_name || <Chip size="small" label="Graduate" />}</TableCell>
                  <TableCell align="right">{r.pass_mark ?? "—"}</TableCell>
                  <TableCell align="right"><IconButton size="small" color="error" onClick={() => delRule.mutate(r.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>Run Promotion</Typography>
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField select size="small" label="From class" value={sourceClass} onChange={(e) => { setSourceClass(e.target.value); setSelected(new Set()); }} sx={{ minWidth: 180 }}>
          {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Promote to" value={targetClass} onChange={(e) => setTargetClass(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Graduate (leave school)</MenuItem>
          {(classes.data ?? []).filter((c) => c.id !== sourceClass).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <Divider orientation="vertical" flexItem />
        <Button variant="contained" disabled={selected.size === 0 || run.isPending} onClick={() => run.mutate()}>
          {targetClass ? `Promote ${selected.size}` : `Graduate ${selected.size}`}
        </Button>
      </Paper>

      {sourceClass && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={darkTableHeadSx}><TableRow>
              <TableCell padding="checkbox"><Checkbox checked={allSelected} indeterminate={selected.size > 0 && !allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(candidates.data!.map((c) => c.student_id)) : new Set())} /></TableCell>
              <TableCell>Roll</TableCell><TableCell>Student</TableCell><TableCell>Admission #</TableCell><TableCell>Section</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {candidates.isLoading ? (
                <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
              ) : (candidates.data?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={5} sx={{ color: "text.secondary" }}>No active students in this class.</TableCell></TableRow>
              ) : candidates.data!.map((c) => (
                <TableRow key={c.student_id} hover selected={selected.has(c.student_id)} onClick={() => toggle(c.student_id)} sx={{ cursor: "pointer" }}>
                  <TableCell padding="checkbox"><Checkbox checked={selected.has(c.student_id)} /></TableCell>
                  <TableCell>{c.roll_number || "—"}</TableCell>
                  <TableCell>{c.full_name}</TableCell>
                  <TableCell>{c.admission_number || "—"}</TableCell>
                  <TableCell>{c.section_name || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={ruleDlg} onClose={() => setRuleDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>Promotion Rule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select size="small" label="Source class" value={rule.source_class_id} onChange={(e) => setRule((r) => ({ ...r, source_class_id: e.target.value }))}>
              {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Promotes to" value={rule.target_class_id} onChange={(e) => setRule((r) => ({ ...r, target_class_id: e.target.value }))}>
              <MenuItem value="">Graduate</MenuItem>
              {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField size="small" type="number" label="Pass mark (advisory)" value={rule.pass_mark} onChange={(e) => setRule((r) => ({ ...r, pass_mark: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => addRule.mutate()} disabled={!rule.source_class_id || addRule.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
