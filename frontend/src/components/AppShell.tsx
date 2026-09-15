import type { ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import SchoolIcon from "@mui/icons-material/School";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuIcon from "@mui/icons-material/Menu";
import { useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "../auth/AuthContext";

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  children?: { label: string; to: string }[];
}

const DRAWER_WIDTH = 250;
const SIDEBAR_BG = "#0b2e42";
const TOPBAR_BG = "#0e3550";
const SIDEBAR_BG_HOVER = "#123f5c";
const SIDEBAR_ACCENT = "#14b8a6";
const SIDEBAR_TEXT = "rgba(255,255,255,0.85)";
const SIDEBAR_TEXT_MUTED = "rgba(255,255,255,0.55)";

function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts.length > 1 ? parts[parts.length - 1][0] : "").toUpperCase();
}

function isChildActive(children: { to: string }[] | undefined, fullPath: string): boolean {
  return !!children?.some((c) => fullPath === c.to || fullPath.startsWith(`${c.to}&`) || fullPath.startsWith(`${c.to}?`));
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const datePart = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const timePart = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${datePart}  ${timePart}`;
}

function NavGroup({ item, fullPath }: { item: NavItem; fullPath: string }) {
  const hasChildren = !!item.children?.length;
  const childActive = isChildActive(item.children, fullPath);
  const [open, setOpen] = useState(childActive);

  if (!hasChildren) {
    const active = fullPath === item.to;
    return (
      <ListItemButton
        component={RouterLink}
        to={item.to}
        selected={active}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          color: SIDEBAR_TEXT,
          "&:hover": { bgcolor: SIDEBAR_BG_HOVER },
          "&.Mui-selected": { bgcolor: SIDEBAR_ACCENT, color: "#fff" },
          "&.Mui-selected:hover": { bgcolor: SIDEBAR_ACCENT },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} />
      </ListItemButton>
    );
  }

  return (
    <>
      <ListItemButton
        onClick={() => setOpen((v) => !v)}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          color: childActive ? "#fff" : SIDEBAR_TEXT,
          "&:hover": { bgcolor: SIDEBAR_BG_HOVER },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} />
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {item.children!.map((child) => {
            const active = fullPath === child.to;
            return (
              <ListItemButton
                key={child.to}
                component={RouterLink}
                to={child.to}
                selected={active}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  pl: 5.5,
                  color: SIDEBAR_TEXT_MUTED,
                  "&:hover": { bgcolor: SIDEBAR_BG_HOVER, color: "#fff" },
                  "&.Mui-selected": { bgcolor: SIDEBAR_ACCENT, color: "#fff" },
                  "&.Mui-selected:hover": { bgcolor: SIDEBAR_ACCENT },
                }}
              >
                <ListItemText primary={child.label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
              </ListItemButton>
            );
          })}
        </List>
      </Collapse>
    </>
  );
}

export function AppShell({
  title,
  navItems = [],
  children,
}: {
  title: string;
  navItems?: NavItem[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const fullPath = `${location.pathname}${location.search}`;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const clock = useLiveClock();
  const hasSidebar = navItems.length > 0 && sidebarOpen;

  function handleMenuOpen(event: MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }
  function handleMenuClose() {
    setAnchorEl(null);
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: TOPBAR_BG,
          color: "#fff",
          zIndex: (t) => t.zIndex.drawer + 1,
          width: hasSidebar ? `calc(100% - ${DRAWER_WIDTH}px)` : "100%",
          ml: hasSidebar ? `${DRAWER_WIDTH}px` : 0,
          transition: "width 0.2s, margin-left 0.2s",
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {navItems.length > 0 && (
            <IconButton onClick={() => setSidebarOpen((v) => !v)} sx={{ color: "#fff" }} size="small">
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "rgba(255,255,255,0.7)", display: { xs: "none", md: "block" }, ml: 2 }}
          >
            {clock}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            size="small"
            label={user?.role}
            variant="outlined"
            sx={{ textTransform: "capitalize", mr: 1, color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}
          />
          <Tooltip title="Account">
            <IconButton onClick={handleMenuOpen} size="small">
              <Avatar sx={{ width: 32, height: 32, bgcolor: SIDEBAR_ACCENT, fontSize: 14 }}>
                {initialsOf(user?.full_name)}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleMenuClose}>
            <MenuItem disabled sx={{ opacity: "1 !important" }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {user?.full_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={logout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Log out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {hasSidebar && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              bgcolor: SIDEBAR_BG,
              borderRight: "none",
            },
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <SchoolIcon sx={{ color: SIDEBAR_ACCENT }} />
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, color: "#fff" }}>
              Online Academy
            </Typography>
          </Toolbar>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
          <List sx={{ px: 1, pt: 1 }}>
            {navItems.map((item) => (
              <NavGroup key={item.label} item={item} fullPath={fullPath} />
            ))}
          </List>
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: "100%" }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
