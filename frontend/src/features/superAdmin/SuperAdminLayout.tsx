import { useState, type ReactNode } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import SchoolIcon from "@mui/icons-material/SchoolOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useAuth } from "../../auth/AuthContext";
import { shellColors } from "../../theme";

const DRAWER_WIDTH = 240;

const navItems = [
  { label: "Dashboard", to: "/super_admin", icon: <DashboardIcon /> },
  { label: "Schools", to: "/super_admin/schools", icon: <SchoolIcon /> },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2.5, pb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: shellColors.sidebarAccent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AdminPanelSettingsIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, color: "#fff", fontSize: 14, lineHeight: 1.2 }}>
            Platform Admin
          </Typography>
          <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Super Admin Panel</Typography>
        </Box>
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mx: 2 }} />

      <List sx={{ px: 1, pt: 1.5, flexGrow: 1 }}>
        {navItems.map((item) => {
          const active = location.pathname === item.to || (item.to !== "/super_admin" && location.pathname.startsWith(item.to));
          return (
            <ListItem key={item.to} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                component={RouterLink}
                to={item.to}
                onClick={onClose}
                selected={active}
                sx={{
                  borderRadius: 1.5,
                  color: active ? "#fff" : "rgba(255,255,255,0.65)",
                  bgcolor: active ? "rgba(20,184,166,0.18)" : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.07)", color: "#fff" },
                  "&.Mui-selected": { bgcolor: "rgba(20,184,166,0.18)", color: "#fff" },
                  "&.Mui-selected:hover": { bgcolor: "rgba(20,184,166,0.25)" },
                }}
              >
                <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const drawerSx = {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    "& .MuiDrawer-paper": {
      width: DRAWER_WIDTH,
      boxSizing: "border-box",
      bgcolor: shellColors.sidebarBg,
      borderRight: "none",
    },
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Permanent sidebar for desktop */}
      <Drawer variant="permanent" sx={{ ...drawerSx, display: { xs: "none", md: "block" } }}>
        <SidebarContent />
      </Drawer>

      {/* Temporary drawer for mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ ...drawerSx, display: { xs: "block", md: "none" } }}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </Drawer>

      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: shellColors.headerDark,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            zIndex: (theme) => theme.zIndex.drawer - 1,
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <IconButton
              color="inherit"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Account">
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
                <Avatar sx={{ width: 32, height: 32, bgcolor: shellColors.sidebarAccent, fontSize: 14 }}>
                  {user?.full_name?.[0]?.toUpperCase() ?? "S"}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                Sign out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, bgcolor: "background.default" }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
