import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Paper,
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
import { listQuizzes } from "../../../api/quizzes";

export function QuizListPage() {
  const navigate = useNavigate();
  const quizzesQuery = useQuery({ queryKey: ["quizzes", "student"], queryFn: () => listQuizzes() });

  return (
    <AppShell title="Quizzes" navItems={studentNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Quizzes
      </Typography>

      {quizzesQuery.data?.length === 0 && <Alert severity="info">No quizzes available yet.</Alert>}

      {!!quizzesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Time limit</TableCell>
                <TableCell>Due</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quizzesQuery.data.map((q) => (
                <TableRow key={q.id} hover>
                  <TableCell>{q.title}</TableCell>
                  <TableCell>{q.time_limit_minutes ? `${q.time_limit_minutes} min` : "—"}</TableCell>
                  <TableCell>{q.due_date ? new Date(q.due_date).toLocaleString() : "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="contained" onClick={() => navigate(`/student/quizzes/${q.id}/take`)}>
                      Open
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
