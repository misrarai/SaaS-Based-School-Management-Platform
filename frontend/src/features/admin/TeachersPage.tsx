import { useState } from "react";
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
  InputAdornment,
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
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { AppShell } from "../../components/AppShell";
import { adminNavItems } from "./adminNav";
import { darkTableHeadSx } from "../../components/tableStyles";
import { createTeacher, listTeachers, setTeacherActive } from "../../api/teachers";

export function TeachersPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const teachersQuery = useQuery({
    queryKey: ["teachers", appliedSearch],
    queryFn: () => listTeachers(appliedSearch || undefined),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [qualification, setQualification] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addTeacher = useMutation({
    mutationFn: () =>
      createTeacher({ full_name: fullName, email, password, qualification: qualification || undefined }),
    onSuccess: () => {
      setFullName("");
      setEmail("");
      setPassword("");
      setQualification("");
      setError(null);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: () => setError("Could not create teacher (email may already be in use)."),
  });

  const toggleActive = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) => setTeacherActive(vars.id, vars.isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teachers"] }),
  });

  return (
    <AppShell title="Teachers" navItems={adminNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Teachers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add teacher
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Search by name, email, or qualification"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(searchInput)}
            sx={{ minWidth: 320 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button variant="contained" color="success" onClick={() => setAppliedSearch(searchInput)}>
            Search
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          There are <strong>{teachersQuery.data?.length ?? 0}</strong> teachers registered.
        </Typography>
      </Paper>

      {teachersQuery.isLoading && <Typography>Loading…</Typography>}
      {teachersQuery.data?.length === 0 && (
        <Alert severity="info">No teachers yet — click "Add teacher" to create the first one.</Alert>
      )}

      {!!teachersQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Qualification</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teachersQuery.data.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{t.full_name}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>{t.qualification ?? "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t.is_active ? "Active" : "Inactive"}
                      color={t.is_active ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => toggleActive.mutate({ id: t.id, isActive: !t.is_active })}>
                      {t.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add a teacher</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            addTeacher.mutate();
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Temporary password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Qualification (optional)"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addTeacher.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </AppShell>
  );
}
