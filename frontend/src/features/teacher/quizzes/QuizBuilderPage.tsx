import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { AppShell } from "../../../components/AppShell";
import { teacherNavItems } from "../teacherNav";
import { listClasses, listSections, listSubjects } from "../../../api/classes";
import { createQuiz, type QuestionCreatePayload, type QuestionType } from "../../../api/quizzes";

interface QuestionDraft {
  questionText: string;
  questionType: QuestionType;
  marks: string;
  options: string[];
  correctIndex: number | null;
}

function defaultOptionsFor(type: QuestionType): string[] {
  if (type === "true_false") return ["True", "False"];
  if (type === "short_answer") return [];
  return ["", ""];
}

function newQuestion(type: QuestionType = "mcq_single"): QuestionDraft {
  return {
    questionText: "",
    questionType: type,
    marks: "1",
    options: defaultOptionsFor(type),
    correctIndex: null,
  };
}

export function QuizBuilderPage() {
  const navigate = useNavigate();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const sectionsQuery = useQuery({
    queryKey: ["sections", classGradeId],
    queryFn: () => listSections(classGradeId),
    enabled: !!classGradeId,
  });
  const subjectsQuery = useQuery({
    queryKey: ["subjects", classGradeId],
    queryFn: () => listSubjects(classGradeId),
    enabled: !!classGradeId,
  });
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(qIndex: number, oIndex: number, text: string) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? text : o)) } : q)),
    );
  }

  function addOption(qIndex: number) {
    setQuestions((qs) => qs.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ""] } : q)));
  }

  function removeOption(qIndex: number, oIndex: number) {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qIndex) return q;
        const nextCorrect =
          q.correctIndex === oIndex ? null : q.correctIndex !== null && q.correctIndex > oIndex ? q.correctIndex - 1 : q.correctIndex;
        return { ...q, options: q.options.filter((_, j) => j !== oIndex), correctIndex: nextCorrect };
      }),
    );
  }

  function setQuestionType(qIndex: number, type: QuestionType) {
    updateQuestion(qIndex, { questionType: type, options: defaultOptionsFor(type), correctIndex: null });
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, newQuestion()]);
  }

  function removeQuestion(index: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== index));
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
    onSuccess: () => navigate("/teacher/quizzes"),
    onError: () =>
      setError(
        "Could not create quiz — check every question has exactly one correct option and you're scheduled to teach this class/subject.",
      ),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (questions.some((q) => q.questionType !== "short_answer" && q.correctIndex === null)) {
      setError("Mark the correct answer for every question.");
      return;
    }
    create.mutate();
  }

  return (
    <AppShell title="New Quiz" navItems={teacherNavItems}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        New quiz
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Stack spacing={2}>
            <FormControl fullWidth required>
              <InputLabel id="q-class-label">Class</InputLabel>
              <Select
                labelId="q-class-label"
                label="Class"
                value={classGradeId}
                onChange={(e) => {
                  setClassGradeId(e.target.value);
                  setSectionId("");
                  setSubjectId("");
                }}
              >
                {classesQuery.data?.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth required disabled={!classGradeId}>
                <InputLabel id="q-section-label">Section</InputLabel>
                <Select
                  labelId="q-section-label"
                  label="Section"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                >
                  {sectionsQuery.data?.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required disabled={!classGradeId}>
                <InputLabel id="q-subject-label">Subject</InputLabel>
                <Select
                  labelId="q-subject-label"
                  label="Subject"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  {subjectsQuery.data?.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Time limit in minutes (optional)"
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                fullWidth
              />
              <TextField
                label="Due date (optional)"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </Stack>
        </Paper>

        {questions.map((q, qIndex) => (
          <Paper key={qIndex} variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 2 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Question {qIndex + 1}
              </Typography>
              {questions.length > 1 && (
                <IconButton size="small" color="error" onClick={() => removeQuestion(qIndex)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            <Stack spacing={2}>
              <TextField
                label="Question text"
                value={q.questionText}
                onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
                required
                fullWidth
                multiline
              />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id={`type-label-${qIndex}`}>Type</InputLabel>
                  <Select
                    labelId={`type-label-${qIndex}`}
                    label="Type"
                    value={q.questionType}
                    onChange={(e) => setQuestionType(qIndex, e.target.value as QuestionType)}
                  >
                    <MenuItem value="mcq_single">Multiple choice</MenuItem>
                    <MenuItem value="true_false">True / False</MenuItem>
                    <MenuItem value="short_answer">Short answer</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Marks"
                  type="number"
                  value={q.marks}
                  onChange={(e) => updateQuestion(qIndex, { marks: e.target.value })}
                  fullWidth
                />
              </Stack>

              {q.questionType === "short_answer" ? (
                <Alert severity="info" variant="outlined">
                  Students will type a free-text answer. You'll grade this yourself after they submit.
                </Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Select the correct option:
                  </Typography>
                  <RadioGroup
                    value={q.correctIndex === null ? "" : String(q.correctIndex)}
                    onChange={(e) => updateQuestion(qIndex, { correctIndex: Number(e.target.value) })}
                  >
                    {q.options.map((optText, oIndex) => (
                      <Stack key={oIndex} direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                        <FormControlLabel value={String(oIndex)} control={<Radio />} label="" sx={{ mr: 0 }} />
                        <TextField
                          size="small"
                          value={optText}
                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                          placeholder={`Option ${oIndex + 1}`}
                          required
                          disabled={q.questionType === "true_false"}
                          fullWidth
                        />
                        {q.questionType === "mcq_single" && q.options.length > 2 && (
                          <IconButton size="small" onClick={() => removeOption(qIndex, oIndex)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    ))}
                  </RadioGroup>
                  {q.questionType === "mcq_single" && (
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => addOption(qIndex)}
                      sx={{ alignSelf: "flex-start" }}
                    >
                      Add option
                    </Button>
                  )}
                </>
              )}
            </Stack>
          </Paper>
        ))}

        <Button startIcon={<AddIcon />} onClick={addQuestion} sx={{ mb: 3 }}>
          Add question
        </Button>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Divider sx={{ mb: 2 }} />
        <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={() => navigate("/teacher/quizzes")}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={create.isPending || !sectionId || !subjectId}>
            {create.isPending ? "Creating…" : "Create quiz"}
          </Button>
        </Stack>
      </Box>
    </AppShell>
  );
}
