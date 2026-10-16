import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { createTodo, deleteTodo, listTodos, updateTodo } from "../../../api/communication";
import { CommunicationShell, PageHeader, fmtDate } from "./common";

export function TodosPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const todos = useQuery({ queryKey: ["comm-todos"], queryFn: () => listTodos(true) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["comm-todos"] });

  const add = useMutation({
    mutationFn: () => createTodo({ title: title.trim(), due_date: due || undefined }),
    onSuccess: () => { setTitle(""); setDue(""); invalidate(); },
  });
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => updateTodo(id, { is_done: done }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteTodo(id), onSuccess: invalidate });

  const pending = (todos.data ?? []).filter((t) => !t.is_done);
  const done = (todos.data ?? []).filter((t) => t.is_done);

  return (
    <CommunicationShell title="To-do List">
      <PageHeader title="To-do List" />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
          <TextField size="small" label="New task" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) add.mutate(); }} sx={{ flex: 1, minWidth: 220 }} />
          <TextField size="small" type="date" label="Due" slotProps={{ inputLabel: { shrink: true } }} value={due} onChange={(e) => setDue(e.target.value)} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => add.mutate()} disabled={!title.trim() || add.isPending}>Add</Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <List>
          {(todos.data?.length ?? 0) === 0 ? (
            <ListItem><ListItemText primary="No tasks yet." sx={{ color: "text.secondary" }} /></ListItem>
          ) : (
            <>
              {pending.map((t) => (
                <ListItem key={t.id} secondaryAction={<IconButton edge="end" color="error" onClick={() => remove.mutate(t.id)}><DeleteIcon /></IconButton>}>
                  <Checkbox checked={false} onChange={() => toggle.mutate({ id: t.id, done: true })} />
                  <ListItemText primary={t.title} secondary={t.due_date ? `Due ${fmtDate(t.due_date)}` : undefined} />
                </ListItem>
              ))}
              {done.length > 0 && <Typography variant="overline" sx={{ px: 2, color: "text.secondary" }}>Done</Typography>}
              {done.map((t) => (
                <ListItem key={t.id} secondaryAction={<IconButton edge="end" color="error" onClick={() => remove.mutate(t.id)}><DeleteIcon /></IconButton>}>
                  <Checkbox checked onChange={() => toggle.mutate({ id: t.id, done: false })} />
                  <ListItemText primary={<Box component="span" sx={{ textDecoration: "line-through", color: "text.secondary" }}>{t.title}</Box>} />
                </ListItem>
              ))}
            </>
          )}
        </List>
      </Paper>
    </CommunicationShell>
  );
}
