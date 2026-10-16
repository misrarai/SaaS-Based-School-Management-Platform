import { useState } from "react";
import { Alert, FormControlLabel, Switch } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { CoursesManager } from "../academics/CoursesManager";
import type { Course } from "../../../api/courses";

const COACHING_PATTERN = /coach|tuition|extra|remedial|prep/i;
const isCoaching = (c: Course) => COACHING_PATTERN.test(c.subject_name);

export function ExtraCoachingPage() {
  const [onlyCoaching, setOnlyCoaching] = useState(true);
  return (
    <AppShell title="Extra Coaching" navItems={adminNavItems}>
      <CoursesManager
        filterCourse={onlyCoaching ? isCoaching : undefined}
        emptyText="No coaching batches yet. Add a subject such as “Extra Coaching – Maths” to a class, then create a course for it."
        intro={
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <FormControlLabel
                control={<Switch size="small" checked={onlyCoaching} onChange={(e) => setOnlyCoaching(e.target.checked)} />}
                label="Coaching only"
                sx={{ mr: 1 }}
              />
            }
          >
            Extra coaching batches are run as courses. Create a subject whose name contains “Coaching”, “Tuition” or
            “Extra” under the class, then create a course for it, assign a teacher and enroll the students who opted in.
          </Alert>
        }
      />
    </AppShell>
  );
}
