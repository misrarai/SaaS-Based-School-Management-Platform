import { createTheme } from "@mui/material/styles";

/** Admin-ERP shell colours (dark sidebar + top bar). Also exposed as `theme.palette.sidebar`. */
export const shellColors = {
  sidebarBg: "#0b2e42",
  sidebarBgHover: "#123f5c",
  sidebarGroupBg: "#08263a",
  sidebarAccent: "#14b8a6",
  sidebarText: "rgba(255,255,255,0.85)",
  sidebarTextMuted: "rgba(255,255,255,0.55)",
  sidebarDivider: "rgba(255,255,255,0.08)",
  topbarBg: "#ffffff",
  topbarText: "#0e3550",
  headerDark: "#0e3550",
} as const;

/** Tile colours used by dashboards (SkoolZoom-style coloured stat tiles). */
export const tileColors = {
  blue: "#2f80ed",
  teal: "#0f9d8e",
  green: "#27ae60",
  orange: "#f2994a",
  red: "#eb5757",
  purple: "#9b51e0",
  navy: "#1e3a5f",
  pink: "#e84393",
  cyan: "#00a8c6",
  amber: "#d4a017",
} as const;

declare module "@mui/material/styles" {
  interface Palette {
    sidebar: typeof shellColors;
  }
  interface PaletteOptions {
    sidebar?: typeof shellColors;
  }
}

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1e3a5f", light: "#3f5f85", dark: "#122438" },
    secondary: { main: "#0f9d8e" },
    background: { default: "#f1f4f8", paper: "#ffffff" },
    sidebar: shellColors,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: ['"Roboto"', '"Helvetica"', "Arial", "sans-serif"].join(","),
    h1: { fontSize: "2rem", fontWeight: 700 },
    h4: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
    },
    MuiAppBar: {
      styleOverrides: { root: { boxShadow: "none", borderBottom: "1px solid #e0e0e0" } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
  },
});
