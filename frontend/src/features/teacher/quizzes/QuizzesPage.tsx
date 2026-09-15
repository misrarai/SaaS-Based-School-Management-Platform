import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listQuizzes, setQuizPublished } from "../../../api/quizzes";

export function QuizzesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const quizzesQuery = useQuery({ queryKey: ["quizzes", "teacher"], queryFn: () => listQuizzes() });

  const togglePublish = useMutation({
    mutationFn: ({ quizId, isPublished }: { quizId: string; isPublished: boolean }) =>
      setQuizPublished(quizId, isPublished),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quizzes"] }),
  });

  return (
    <AppShell title="Quizzes" navItems={teacherNavItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Quizzes</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/teacher/quizzes/new")}>
          New quiz
        </Button>
      </Stack>

      {quizzesQuery.data?.length === 0 && <Alert severity="info">No quizzes created yet.</Alert>}

      {!!quizzesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Time limit</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>Published</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quizzesQuery.data.map((q) => (
                <TableRow key={q.id} hover>
                  <TableCell>{q.title}</TableCell>
                  <TableCell>{q.time_limit_minutes ? `${q.time_limit_minutes} min` : "—"}</TableCell>
                  <TableCell>{q.due_date ? new Date(q.due_date).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Switch
                        size="small"
                        checked={q.is_published}
                        onChange={(e) => togglePublish.mutate({ quizId: q.id, isPublished: e.target.checked })}
                      />
                      <Chip
                        size="small"
                        label={q.is_published ? "Published" : "Draft"}
                        color={q.is_published ? "success" : "default"}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => navigate(`/teacher/quizzes/${q.id}/results`)}>
                      View results
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
