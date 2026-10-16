import { useNavigate } from "react-router-dom";
import { Button, Stack } from "@mui/material";

export type ExamTabKey = "exams" | "schemes" | "marks" | "results";

const TABS: { key: ExamTabKey; label: string; to: string }[] = [
  { key: "exams", label: "Exams & Datesheets", to: "/admin/exams" },
  { key: "schemes", label: "Grading Schemes", to: "/admin/exams/grading-schemes" },
  { key: "marks", label: "Marks Entry", to: "/admin/exams/marks" },
  { key: "results", label: "Results / Tabulation", to: "/admin/exams/results" },
];

/** Pill-style sub-navigation shared by the admin examination pages (same look as StaffPage tabs). */
export function ExamTabs({ current }: { current: ExamTabKey }) {
  const navigate = useNavigate();
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
      {TABS.map((tab) => {
        const selected = tab.key === current;
        return (
          <Button
            key={tab.key}
            onClick={() => navigate(tab.to)}
            variant={selected ? "contained" : "outlined"}
            size="small"
            sx={{
              borderRadius: 1,
              bgcolor: selected ? "#0e3550" : "#fff",
              color: selected ? "#fff" : "text.primary",
              borderColor: "#d0d5dd",
              "&:hover": { bgcolor: selected ? "#0e3550" : "#f5f5f5", borderColor: "#d0d5dd" },
            }}
          >
            {tab.label}
          </Button>
        );
      })}
    </Stack>
  );
}
