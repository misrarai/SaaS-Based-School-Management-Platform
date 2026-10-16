import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { listClasses, listSections, listSubjects } from "../../../api/classes";
import { createQuiz, type QuestionCreatePayload, type QuestionType } from "../../../api/quizzes";

interface QuestionDraft {
  questionText: string;
  questionType: QuestionType;
  marks: string;
  options: string[];
  correctIndex: number | null;
}

function defaultOptions(type: QuestionType): string[] {
  if (type === "true_false") return ["True", "False"];
  if (type === "short_answer") return [];
  return ["", ""];
}

function newQuestion(type: QuestionType = "mcq_single"): QuestionDraft {
  return { questionText: "", questionType: type, marks: "1", options: defaultOptions(type), correctIndex: null };
}

export function AdminQuizBuilderPage() {
  const navigate = useNavigate();

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const sectionsQuery = useQuery({ queryKey: ["sections", classGradeId], queryFn: () => listSections(classGradeId), enabled: !!classGradeId });
  const subjectsQuery = useQuery({ queryKey: ["subjects", classGradeId], queryFn: () => listSubjects(classGradeId), enabled: !!classGradeId });

  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function updateOption(qi: number, oi: number, text: string) {
    setQuestions((qs) => qs.map((q, i) => i === qi ? { ...q, options: q.options.map((o, j) => j === oi ? text : o) } : q));
  }

  function addOption(qi: number) {
    setQuestions((qs) => qs.map((q, i) => i === qi ? { ...q, options: [...q.options, ""] } : q));
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== qi) return q;
      const nextCorrect = q.correctIndex === oi ? null : q.correctIndex !== null && q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex;
      return { ...q, options: q.options.filter((_, j) => j !== oi), correctIndex: nextCorrect };
    }));
  }

  function setType(qi: number, type: QuestionType) {
    updateQuestion(qi, { questionType: type, options: defaultOptions(type), correctIndex: null });
  }

  const create = useMutation({
    mutationFn: () => {
      const payloadQuestions: QuestionCreatePayload[] = questions.map((q) => ({
        question_text: q.questionText,
        question_type: q.questionType,
        marks: Number(q.marks) || 1,
        options: q.options.map((text, i) => ({ option_text: text, is_correct: i === q.correctIndex })),
      }));
      return createQuiz({
        section_id: sectionId,
        subject_id: subjectId,
        title,
        description: description || undefined,
        time_limit_minutes: timeLimit ? Number(timeLimit) : undefined,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        questions: payloadQuestions,
      });
    },
    onSuccess: () => navigate("/admin/lms/quizzes"),
    onError: () => setError("Could not create quiz — make sure every question has a correct answer selected and the class/section/subject exists."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sectionId || !subjectId) { setError("Please select a class, section, and subject."); return; }
    if (questions.some((q) => q.questionType !== "short_answer" && q.correctIndex === null)) {
      setError("Mark the correct answer for every question.");
      return;
    }
    create.mutate();
  }

  return (
    <AppShell title="New Quiz" navItems={adminNavItems}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Create New Quiz</Typography>
        <Button variant="outlined" onClick={() => navigate("/admin/lms/quizzes")}>Cancel</Button>
      </Stack>

      <Box component="form" onSubmit={handleSubmit}>
        {/* Quiz details */}
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Quiz Details</Typography>
          <Stack spacing={2}>
            <FormControl fullWidth required size="small">
              <InputLabel>Class</InputLabel>
              <Select value={classGradeId} label="Class" onChange={(e) => { setClassGradeId(e.target.value); setSectionId(""); setSubjectId(""); }}>
                {(classesQuery.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth required size="small" disabled={!classGradeId}>
                <InputLabel>Section</InputLabel>
                <Select value={sectionId} label="Section" onChange={(e) => setSectionId(e.target.value)}>
                  {(sectionsQuery.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth required size="small" disabled={!classGradeId}>
                <InputLabel>Subject</InputLabel>
                <Select value={subjectId} label="Subject" onChange={(e) => setSubjectId(e.target.value)}>
                  {(subjectsQuery.data ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <TextField label="Quiz Title *" size="small" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth placeholder="e.g. Chapter 3 Test" />
            <TextField label="Description (optional)" size="small" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={2} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Time Limit (minutes)" type="number" size="small" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} fullWidth placeholder="e.g. 30" />
              <TextField label="Due Date (optional)" type="datetime-local" size="small" value={dueDate} onChange={(e) => setDueDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
          </Stack>
        </Paper>

        {/* Questions */}
        {questions.map((q, qi) => (
          <Paper key={qi} variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Question {qi + 1}</Typography>
              {questions.length > 1 && (
                <IconButton size="small" color="error" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            <Stack spacing={2}>
              <TextField label="Question text *" size="small" value={q.questionText} onChange={(e) => updateQuestion(qi, { questionText: e.target.value })} required fullWidth multiline />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select value={q.questionType} label="Type" onChange={(e) => setType(qi, e.target.value as QuestionType)}>
                    <MenuItem value="mcq_single">Multiple Choice</MenuItem>
                    <MenuItem value="true_false">True / False</MenuItem>
                    <MenuItem value="short_answer">Short Answer</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Marks" type="number" size="small" value={q.marks} onChange={(e) => updateQuestion(qi, { marks: e.target.value })} fullWidth />
              </Stack>

              {q.questionType === "short_answer" ? (
                <Alert severity="info" variant="outlined">Students type a free-text answer. You'll grade this manually after submission.</Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">Click the radio button next to the correct answer:</Typography>
                  <RadioGroup value={q.correctIndex === null ? "" : String(q.correctIndex)} onChange={(e) => updateQuestion(qi, { correctIndex: Number(e.target.value) })}>
                    {q.options.map((optText, oi) => (
                      <Stack key={oi} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <FormControlLabel value={String(oi)} control={<Radio size="small" />} label="" sx={{ mr: 0 }} />
                        <TextField
                          size="small" value={optText} onChange={(e) => updateOption(qi, oi, e.target.value)}
                          placeholder={`Option ${oi + 1}`} required disabled={q.questionType === "true_false"} fullWidth
                        />
                        {q.questionType === "mcq_single" && q.options.length > 2 && (
                          <IconButton size="small" onClick={() => removeOption(qi, oi)}><DeleteIcon fontSize="small" /></IconButton>
                        )}
                      </Stack>
                    ))}
                  </RadioGroup>
                  {q.questionType === "mcq_single" && (
                    <Button size="small" startIcon={<AddIcon />} onClick={() => addOption(qi)} sx={{ alignSelf: "flex-start" }}>Add option</Button>
                  )}
                </>
              )}
            </Stack>
          </Paper>
        ))}

        <Button startIcon={<AddIcon />} onClick={() => setQuestions((qs) => [...qs, newQuestion()])} sx={{ mb: 3 }}>
          Add Question
        </Button>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Divider sx={{ mb: 2 }} />
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button variant="outlined" onClick={() => navigate("/admin/lms/quizzes")}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={create.isPending || !title}>
            {create.isPending ? "Creating…" : "Create Quiz"}
          </Button>
        </Stack>
      </Box>
    </AppShell>
  );
}
