import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import {
  issueBook,
  listLibraryMembers,
  returnByCopy,
  libraryErrorMessage,
  type LibraryMember,
} from "../../../api/library";

type Mode = "return" | "issue";
interface LogRow { at: string; code: string; ok: boolean; message: string }

export function QuickScanPage() {
  const [mode, setMode] = useState<Mode>("return");
  const [code, setCode] = useState("");
  const [member, setMember] = useState<LibraryMember | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const members = useQuery({ queryKey: ["library", "members-all"], queryFn: () => listLibraryMembers() });

  const push = (code: string, ok: boolean, message: string) =>
    setLog((l) => [{ at: new Date().toLocaleTimeString(), code, ok, message }, ...l].slice(0, 25));

  const doReturn = useMutation({
    mutationFn: (c: string) => returnByCopy(c, {}),
    onSuccess: (issue, c) => push(c, true, `Returned "${issue.book_title}"${issue.fine_amount ? ` · fine ${issue.fine_amount}` : ""}`),
    onError: (e, c) => push(c, false, libraryErrorMessage(e, "Return failed")),
  });

  const doIssue = useMutation({
    mutationFn: (c: string) => issueBook({ member_id: member!.id, copy_identifier: c }),
    onSuccess: (issue, c) => push(c, true, `Issued "${issue.book_title}" to ${issue.member_name} · due ${issue.due_date}`),
    onError: (e, c) => push(c, false, libraryErrorMessage(e, "Issue failed")),
  });

  const submit = () => {
    const c = code.trim();
    if (!c) return;
    if (mode === "issue" && !member) {
      push(c, false, "Select a member first.");
    } else if (mode === "return") {
      doReturn.mutate(c);
    } else {
      doIssue.mutate(c);
    }
    setCode("");
    inputRef.current?.focus();
  };

  return (
    <AppShell title="Library — Quick Scan" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>Quick Scan</Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 2 }}>
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}>
            <ToggleButton value="return">Return</ToggleButton>
            <ToggleButton value="issue">Issue</ToggleButton>
          </ToggleButtonGroup>

          {mode === "issue" && (
            <Autocomplete
              options={members.data ?? []}
              getOptionLabel={(m) => `${m.full_name} · ${m.card_number}`}
              value={member}
              onChange={(_, v) => setMember(v)}
              renderInput={(params) => <TextField {...params} size="small" label="Member" placeholder="Search member…" />}
            />
          )}

          <TextField
            inputRef={inputRef}
            size="small"
            label="Scan accession number or barcode"
            value={code}
            autoFocus
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            helperText="Scan with a barcode reader (acts as keyboard + Enter), or type and press Enter."
          />
          {mode === "issue" && member && (
            <Typography variant="body2" color="text.secondary">
              Issuing to <strong>{member.full_name}</strong> · {member.active_issues} active · fine {member.outstanding_fine}
            </Typography>
          )}
        </Stack>
      </Paper>

      {log.length === 0 ? (
        <Alert severity="info">Scanned items will appear here.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Detail</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {log.map((r, i) => (
                <TableRow key={i} hover>
                  <TableCell>{r.at}</TableCell>
                  <TableCell>{r.code}</TableCell>
                  <TableCell><Chip size="small" color={r.ok ? "success" : "error"} label={r.ok ? "OK" : "Error"} /></TableCell>
                  <TableCell>{r.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Box sx={{ height: 24 }} />
    </AppShell>
  );
}
