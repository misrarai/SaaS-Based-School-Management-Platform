import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MenuItem, Stack, TextField } from "@mui/material";
import { listClasses, listSections } from "../../../api/classes";
import { listStudents, type Student } from "../../../api/students";

/** Class → section → students selection shared by the student document pages. */
export function useClassSectionStudents() {
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [search, setSearch] = useState("");

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const sectionsQuery = useQuery({
    queryKey: ["sections", classId],
    queryFn: () => listSections(classId),
    enabled: !!classId,
  });
  const studentsQuery = useQuery({
    queryKey: ["students", { classGradeId: classId, status: "active" }],
    queryFn: () => listStudents({ classGradeId: classId, status: "active" }),
    enabled: !!classId,
  });

  const students: Student[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (studentsQuery.data ?? [])
      .filter((s) => !sectionId || s.section_id === sectionId)
      .filter(
        (s) =>
          !q ||
          s.full_name.toLowerCase().includes(q) ||
          (s.admission_number ?? "").toLowerCase().includes(q) ||
          (s.roll_number ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [studentsQuery.data, sectionId, search]);

  const classes = classesQuery.data ?? [];
  const sections = sectionsQuery.data ?? [];
  const classNameOf = (id: string | null) => classes.find((c) => c.id === id)?.name ?? "—";
  const sectionNameOf = (id: string | null) => sections.find((s) => s.id === id)?.name ?? "—";

  const filters = (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField
        select
        label="Class"
        value={classId}
        onChange={(e) => {
          setClassId(e.target.value);
          setSectionId("");
        }}
        sx={{ minWidth: 200 }}
        size="small"
      >
        {classes.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Section"
        value={sectionId}
        onChange={(e) => setSectionId(e.target.value)}
        sx={{ minWidth: 160 }}
        size="small"
        disabled={!classId}
      >
        <MenuItem value="">All sections</MenuItem>
        {sections.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {s.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Search name / admission #"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ minWidth: 240 }}
        disabled={!classId}
      />
    </Stack>
  );

  return {
    classId,
    sectionId,
    students,
    isLoading: studentsQuery.isLoading && !!classId,
    filters,
    classNameOf,
    sectionNameOf,
  };
}
