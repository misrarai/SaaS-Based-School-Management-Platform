import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Button, IconButton, Link, MenuItem, Paper, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from "@mui/material";
import UploadIcon from "@mui/icons-material/UploadFileOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createResource, deleteResource, listResources } from "../../../api/resources";
import { uploadDocument, resolveUploadUrl } from "../../../api/uploads";
import { getClassesOverview } from "../../../api/classes";

const CATEGORIES = ["Syllabus", "Study Material", "Other"] as const;

export function DownloadCenterPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const category = CATEGORIES[tab];
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const classes = useQuery({ queryKey: ["classes-overview"], queryFn: getClassesOverview });
  const docs = useQuery({
    queryKey: ["downloads", category],
    queryFn: () => listResources({ category, resourceType: "document" }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["downloads"] });

  const remove = useMutation({ mutationFn: (id: string) => deleteResource(id), onSuccess: invalidate });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!title.trim()) { setNotice({ type: "error", msg: "Enter a title first." }); return; }
    setUploading(true);
    setNotice(null);
    try {
      const url = await uploadDocument(file);
      await createResource({
        title: title.trim(),
        resource_type: "document",
        file_url: url,
        category,
        class_grade_id: classId || undefined,
      });
      setTitle(""); setClassId("");
      setNotice({ type: "success", msg: `"${file.name}" uploaded.` });
      invalidate();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setNotice({ type: "error", msg: typeof detail === "string" ? detail : "Upload failed (check file type/size)." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const className = (id: string | null) => (id ? classes.data?.find((c) => c.id === id)?.name ?? "—" : "All");

  return (
    <AppShell title="Download Center" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>Download Center</Typography>
      <Tabs value={tab} onChange={(_, v) => { setTab(v); setNotice(null); }} sx={{ mb: 2 }}>
        {CATEGORIES.map((c) => <Tab key={c} label={c} />)}
      </Tabs>

      {notice && <Alert severity={notice.type} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.msg}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} sx={{ minWidth: 220 }} />
        <TextField select size="small" label="Class (optional)" value={classId} onChange={(e) => setClassId(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All classes</MenuItem>
          {(classes.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <input ref={fileRef} type="file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="contained" startIcon={<UploadIcon />} disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Uploading…" : `Upload ${category}`}
        </Button>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}><TableRow>
            <TableCell>Title</TableCell><TableCell>Class</TableCell><TableCell>File</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {docs.isLoading ? (
              <TableRow><TableCell colSpan={4}>Loading…</TableCell></TableRow>
            ) : (docs.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={4} sx={{ color: "text.secondary" }}>No {category.toLowerCase()} uploaded yet.</TableCell></TableRow>
            ) : docs.data!.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>{d.title}</TableCell>
                <TableCell>{className(d.class_grade_id)}</TableCell>
                <TableCell>
                  {d.file_url ? (
                    <Link href={resolveUploadUrl(d.file_url)} target="_blank" rel="noopener" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      <DownloadIcon fontSize="small" /> Download
                    </Link>
                  ) : "—"}
                </TableCell>
                <TableCell align="right"><IconButton size="small" color="error" onClick={() => remove.mutate(d.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </AppShell>
  );
}
