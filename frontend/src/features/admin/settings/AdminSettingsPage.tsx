import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import AutorenewIcon from "@mui/icons-material/AutorenewOutlined";
import UpgradeIcon from "@mui/icons-material/UpgradeOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";

const settingCards = [
  {
    icon: <CalendarMonthIcon sx={{ fontSize: 36 }} color="primary" />,
    title: "Academic Years",
    description: "Manage academic years and current session",
    route: "/admin/academic-years",
  },
  {
    icon: <UpgradeIcon sx={{ fontSize: 36 }} color="success" />,
    title: "Student Promotion",
    description: "Promote students to the next class at year end",
    route: "/admin/settings/promotion",
  },
  {
    icon: <AutorenewIcon sx={{ fontSize: 36 }} color="warning" />,
    title: "Automation",
    description: "Auto fee reminders, attendance alerts and more",
    route: "/admin/settings/automation",
  },
  {
    icon: <SchoolIcon sx={{ fontSize: 36 }} color="error" />,
    title: "Curriculum / Subjects",
    description: "Manage subjects for each class",
    route: "/admin/curriculum/subjects",
  },
];

export function AdminSettingsPage() {
  const navigate = useNavigate();
  return (
    <AppShell navItems={adminNavItems} title="Settings">
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SettingsIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight={700}>Settings</Typography>
            <Typography variant="body2" color="text.secondary">
              School configuration and administration settings
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={2}>
          {settingCards.map((card) => (
            <Grid item xs={12} sm={6} md={4} key={card.route}>
              <Card
                variant="outlined"
                sx={{ borderRadius: 2, cursor: "pointer", "&:hover": { borderColor: "primary.main", boxShadow: 1 } }}
                onClick={() => navigate(card.route)}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    {card.icon}
                    <Typography variant="subtitle1" fontWeight={700}>{card.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{card.description}</Typography>
                    <Button size="small" variant="outlined" onClick={() => navigate(card.route)}>
                      Open →
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </AppShell>
  );
}
