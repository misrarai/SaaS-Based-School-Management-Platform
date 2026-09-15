import { Link as RouterLink } from "react-router-dom";
import { Button, Stack } from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";

export type StudentsActivePage = "register-view" | "add" | "import";

const ACTIVE_BG = "#0e3550";

function ActionButton({
  active,
  to,
  icon,
  label,
}: {
  active: boolean;
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      component={RouterLink}
      to={to}
      startIcon={icon}
      variant={active ? "contained" : "outlined"}
      size="small"
      sx={{
        borderRadius: 1,
        bgcolor: active ? ACTIVE_BG : "#fff",
        color: active ? "#fff" : "text.primary",
        borderColor: "#d0d5dd",
        "&:hover": { bgcolor: active ? ACTIVE_BG : "#f5f5f5", borderColor: "#d0d5dd" },
      }}
    >
      {label}
    </Button>
  );
}

export function StudentsActionBar({ active }: { active: StudentsActivePage }) {
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
      <ActionButton
        active={active === "register-view"}
        to="/admin/students?status=all"
        icon={<AssignmentIcon fontSize="small" />}
        label="Admission Register"
      />
      <ActionButton
        active={active === "add"}
        to="/admin/students/register"
        icon={<AddIcon fontSize="small" />}
        label="Register New Student"
      />
      <ActionButton
        active={active === "import"}
        to="/admin/students/import"
        icon={<UploadFileIcon fontSize="small" />}
        label="Import Students"
      />
    </Stack>
  );
}
