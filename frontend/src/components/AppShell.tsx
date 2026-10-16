import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import LogoutIcon from "@mui/icons-material/Logout";
import SchoolIcon from "@mui/icons-material/School";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsIcon from "@mui/icons-material/NotificationsNoneOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useAuth } from "../auth/AuthContext";
import { getMyTenant } from "../api/tenants";
import { shellColors as C } from "../theme";

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  children?: { label: string; to: string }[];
}

const DRAWER_WIDTH = 264;
const MINI_WIDTH = 68;
const MINI_KEY = "shell.sidebarMini";

function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts.length > 1 ? parts[parts.length - 1][0] : "").toUpperCase();
}

function matchesPath(to: string, fullPath: string): boolean {
  return fullPath === to || fullPath.startsWith(`${to}&`) || fullPath.startsWith(`${to}?`);
}

function isChildActive(children: { to: string }[] | undefined, fullPath: string): boolean {
  return !!children?.some((c) => matchesPath(c.to, fullPath));
}

function readMini(): boolean {
  try {
    return localStorage.getItem(MINI_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMini(value: boolean) {
  try {
    localStorage.setItem(MINI_KEY, value ? "1" : "0");
  } catch {
    // storage unavailable — preference just won't persist
  }
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const datePart = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const timePart = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <Box
      sx={{
        display: { xs: "none", md: "flex" },
        alignItems: "center",
        gap: 0.75,
        px: 1.5,
        py: 0.5,
        borderRadius: 2,
        bgcolor: "#f1f4f8",
        color: "text.secondary",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <AccessTimeIcon sx={{ fontSize: 16 }} />
      <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
        {datePart} · {timePart}
      </Typography>
    </Box>
  );
}

const itemSx = {
  borderRadius: 1.5,
  mb: 0.25,
  minHeight: 40,
  color: C.sidebarText,
  "&:hover": { bgcolor: C.sidebarBgHover },
  "&.Mui-selected": { bgcolor: C.sidebarAccent, color: "#fff" },
  "&.Mui-selected:hover": { bgcolor: C.sidebarAccent },
} as const;

function NavGroup({
  item,
  fullPath,
  mini,
  forceOpen,
  onNavigate,
}: {
  item: NavItem;
  fullPath: string;
  mini: boolean;
  forceOpen: boolean;
  onNavigate: () => void;
}) {
  const hasChildren = !!item.children?.length;
  const childActive = isChildActive(item.children, fullPath);
  const [open, setOpen] = useState(childActive);
  const expanded = forceOpen || open;

  if (!hasChildren || mini) {
    const active = hasChildren ? childActive : fullPath === item.to;
    return (
      <Tooltip title={mini ? item.label : ""} placement="right">
        <ListItemButton
          component={RouterLink}
          to={item.to}
          selected={active}
          onClick={onNavigate}
          sx={{ ...itemSx, justifyContent: mini ? "center" : "flex-start", px: mini ? 1 : 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: mini ? 0 : 36, color: "inherit" }}>{item.icon}</ListItemIcon>
          {!mini && <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }} />}
        </ListItemButton>
      </Tooltip>
    );
  }

  return (
    <>
      <ListItemButton
        onClick={() => setOpen((v) => !v)}
        sx={{ ...itemSx, px: 1.5, color: childActive ? "#fff" : C.sidebarText, bgcolor: childActive ? C.sidebarBgHover : undefined }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: childActive ? C.sidebarAccent : "inherit" }}>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }} />
        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List component="div" disablePadding sx={{ bgcolor: C.sidebarGroupBg, borderRadius: 1.5, mb: 0.5, py: 0.5 }}>
          {item.children!.map((child) => {
            const active = matchesPath(child.to, fullPath);
            return (
              <ListItemButton
                key={child.to}
                component={RouterLink}
                to={child.to}
                selected={active}
                onClick={onNavigate}
                sx={{
                  ...itemSx,
                  minHeight: 34,
                  mx: 0.5,
                  pl: 4.5,
                  color: C.sidebarTextMuted,
                  "&:hover": { bgcolor: C.sidebarBgHover, color: "#fff" },
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: active ? "#fff" : C.sidebarTextMuted,
                    mr: 1.5,
                    flexShrink: 0,
                  }}
                />
                <ListItemText primary={child.label} slotProps={{ primary: { sx: { fontSize: 13.5 } } }} />
              </ListItemButton>
            );
          })}
        </List>
      </Collapse>
    </>
  );
}

function filterNav(items: NavItem[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const out: NavItem[] = [];
  for (const item of items) {
    const selfMatch = item.label.toLowerCase().includes(q);
    if (!item.children?.length) {
      if (selfMatch) out.push(item);
      continue;
    }
    const kids = selfMatch ? item.children : item.children.filter((c) => c.label.toLowerCase().includes(q));
    if (kids.length) out.push({ ...item, children: kids });
  }
  return out;
}

function findCrumbs(items: NavItem[], fullPath: string): string[] {
  for (const item of items) {
    if (item.children?.length) {
      const child = item.children.find((c) => matchesPath(c.to, fullPath));
      if (child) return [item.label, child.label];
    } else if (item.to === fullPath) {
      return [item.label];
    }
  }
  return [];
}

export function AppShell({
  title,
  subtitle,
  navItems = [],
  children,
}: {
  title: string;
  /** Optional override for the breadcrumb line under the title. */
  subtitle?: string;
  navItems?: NavItem[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const location = useLocation();
  const navigate = useNavigate();
  const fullPath = `${location.pathname}${location.search}`;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [mini, setMini] = useState(readMini);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const tenantQuery = useQuery({
    queryKey: ["tenant-me"],
    queryFn: getMyTenant,
    enabled: user?.role === "admin",
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const schoolName = tenantQuery.data?.name || "School";

  const hasNav = navItems.length > 0;
  const isMini = isDesktop && mini;
  const drawerWidth = isMini ? MINI_WIDTH : DRAWER_WIDTH;
  const filtered = useMemo(() => filterNav(navItems, search), [navItems, search]);
  const crumbs = useMemo(() => findCrumbs(navItems, fullPath), [navItems, fullPath]);
  const roleHome = user ? `/${user.role}` : "/";
  const subtitleText =
    subtitle ?? ["Home", ...(crumbs.length ? crumbs : [title])].filter((c, i, arr) => arr.indexOf(c) === i).join("  /  ");

  function toggleSidebar() {
    if (isDesktop) {
      setMini((v) => {
        writeMini(!v);
        return !v;
      });
    } else {
      setMobileOpen((v) => !v);
    }
  }

  function handleMenuOpen(event: MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }
  function go(path: string) {
    setAnchorEl(null);
    navigate(path);
  }

  const sidebar = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: C.sidebarBg, color: C.sidebarText }}>
      <Box
        component={RouterLink}
        to={roleHome}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: isMini ? 1 : 2,
          justifyContent: isMini ? "center" : "flex-start",
          minHeight: 64,
          textDecoration: "none",
          borderBottom: `1px solid ${C.sidebarDivider}`,
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            bgcolor: C.sidebarAccent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <SchoolIcon fontSize="small" />
        </Box>
        {!isMini && (
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, color: "#fff", fontSize: 15, lineHeight: 1.2 }}>
              {user?.role === "admin" ? schoolName : "School Portal"}
            </Typography>
            <Typography noWrap sx={{ color: C.sidebarTextMuted, fontSize: 11.5, textTransform: "capitalize" }}>
              {user?.role ?? ""} portal
            </Typography>
          </Box>
        )}
      </Box>

      {!isMini && (
        <Box sx={{ px: 1.5, pt: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.25,
              py: 0.5,
              borderRadius: 1.5,
              bgcolor: "rgba(255,255,255,0.07)",
              border: `1px solid ${C.sidebarDivider}`,
            }}
          >
            <SearchIcon sx={{ fontSize: 18, color: C.sidebarTextMuted }} />
            <InputBase
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…"
              sx={{ color: "#fff", fontSize: 13.5, flex: 1 }}
              inputProps={{ "aria-label": "Search menu" }}
            />
          </Box>
        </Box>
      )}

      <List sx={{ px: 1, pt: 1, flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {filtered.map((item) => (
          <NavGroup
            key={`${item.label}-${search ? "s" : "n"}`}
            item={item}
            fullPath={fullPath}
            mini={isMini}
            forceOpen={!!search.trim()}
            onNavigate={() => setMobileOpen(false)}
          />
        ))}
        {filtered.length === 0 && (
          <Typography sx={{ color: C.sidebarTextMuted, fontSize: 13, px: 1.5, py: 1 }}>No menu items match.</Typography>
        )}
      </List>

      {!isMini && (
        <Typography sx={{ color: C.sidebarTextMuted, fontSize: 11, px: 2, py: 1.5, borderTop: `1px solid ${C.sidebarDivider}` }}>
          School Management System
        </Typography>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          bgcolor: C.topbarBg,
          color: C.topbarText,
          width: hasNav && isDesktop ? `calc(100% - ${drawerWidth}px)` : "100%",
          ml: hasNav && isDesktop ? `${drawerWidth}px` : 0,
          transition: "width 0.2s, margin-left 0.2s",
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 60, sm: 64 } }}>
          {hasNav && (
            <IconButton onClick={toggleSidebar} size="small" sx={{ color: C.topbarText }} aria-label="Toggle sidebar">
              {isDesktop && !mini ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
              {title}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{ color: "text.secondary", display: { xs: "none", sm: "flex" }, alignItems: "center" }}
            >
              {subtitleText.split("  /  ").map((part, i) => (
                <Box component="span" key={`${part}-${i}`} sx={{ display: "inline-flex", alignItems: "center" }}>
                  {i > 0 && <ChevronRightIcon sx={{ fontSize: 14, mx: 0.25 }} />}
                  {part}
                </Box>
              ))}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <LiveClock />
          <Tooltip title="Notifications">
            <IconButton
              size="small"
              sx={{ color: C.topbarText }}
              onClick={() => user?.role === "admin" && navigate("/admin/notifications")}
            >
              <Badge color="error" variant="dot" invisible>
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Chip
            size="small"
            label={user?.role}
            variant="outlined"
            sx={{ textTransform: "capitalize", display: { xs: "none", sm: "flex" } }}
          />
          <Tooltip title="Account">
            <IconButton onClick={handleMenuOpen} size="small">
              <Avatar sx={{ width: 34, height: 34, bgcolor: C.sidebarAccent, fontSize: 14 }}>{initialsOf(user?.full_name)}</Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
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
            <MenuItem onClick={() => go("/account/profile")}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={() => go("/account/password")}>
              <ListItemIcon>
                <LockIcon fontSize="small" />
              </ListItemIcon>
              Change Password
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                void logout();
              }}
            >
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Log out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {hasNav &&
        (isDesktop ? (
          <Drawer
            variant="permanent"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              transition: "width 0.2s",
              [`& .MuiDrawer-paper`]: {
                width: drawerWidth,
                boxSizing: "border-box",
                borderRight: "none",
                overflowX: "hidden",
                transition: "width 0.2s",
              },
            }}
          >
            {sidebar}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box", borderRight: "none" } }}
          >
            {sidebar}
          </Drawer>
        ))}

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, width: "100%", minWidth: 0 }}>
        <Toolbar sx={{ minHeight: { xs: 60, sm: 64 } }} />
        {children}
      </Box>
    </Box>
  );
}
