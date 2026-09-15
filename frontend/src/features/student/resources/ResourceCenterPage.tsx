import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  FormControl,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { studentNavItems } from "../studentNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listSubjects } from "../../../api/classes";
import { resolveUploadUrl } from "../../../api/uploads";
import { listResources } from "../../../api/resources";
import { getMyStudentProfile } from "../../../api/students";

export function ResourceCenterPage() {
  const profileQuery = useQuery({ queryKey: ["students", "me"], queryFn: getMyStudentProfile });
  const [subjectId, setSubjectId] = useState("");
  const subjectsQuery = useQuery({
    queryKey: ["subjects", profileQuery.data?.class_grade_id],
    queryFn: () => listSubjects(profileQuery.data!.class_grade_id!),
    enabled: !!profileQuery.data?.class_grade_id,
  });
  const resourcesQuery = useQuery({
    queryKey: ["resources", "student", subjectId],
    queryFn: () => listResources({ subjectId: subjectId || undefined }),
    enabled: !!profileQuery.data,
  });

  return (
    <AppShell title="Resource Center" navItems={studentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Resource Center
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="subject-label">Subject (optional)</InputLabel>
          <Select
            labelId="subject-label"
            label="Subject (optional)"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <MenuItem value="">All subjects</MenuItem>
            {subjectsQuery.data?.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {resourcesQuery.data?.length === 0 && <Alert severity="info">No resources shared for your class yet.</Alert>}

      {!!resourcesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourcesQuery.data.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <MuiLink
                      href={
                        r.resource_type === "link"
                          ? (r.external_url ?? undefined)
                          : r.file_url
                            ? resolveUploadUrl(r.file_url)
                            : undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {r.title}
                    </MuiLink>
                  </TableCell>
                  <TableCell>{r.category ?? "—"}</TableCell>
                  <TableCell>{r.description ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
