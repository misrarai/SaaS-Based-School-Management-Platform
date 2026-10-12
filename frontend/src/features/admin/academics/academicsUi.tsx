import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmberRounded";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, mb: 3 }}
    >
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.main" }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>{actions}</Stack>}
    </Stack>
  );
}

/** Soft KPI card: tinted icon badge, big number, caption. */
export function StatCard({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  color: string;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        height: "100%",
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        gap: 2,
        position: "relative",
        overflow: "hidden",
        transition: "box-shadow .2s, transform .2s",
        "&:hover": { boxShadow: "0 8px 24px rgba(15, 40, 70, .08)", transform: "translateY(-2px)" },
        "&::after": {
          content: '""',
          position: "absolute",
          right: -24,
          top: -24,
          width: 96,
          height: 96,
          borderRadius: "50%",
          bgcolor: color,
          opacity: 0.07,
        },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2.5,
          display: "grid",
          placeItems: "center",
          color,
          bgcolor: `${color}1a`,
          flexShrink: 0,
          "& svg": { fontSize: 26 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {label}
        </Typography>
        {hint && (
          <Typography variant="caption" sx={{ color, fontWeight: 600 }} noWrap>
            {hint}
          </Typography>
        )}
      </Box>
    </Card>
  );
}

export function ConfirmDeleteDialog({
  open,
  title,
  message,
  error,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  error?: string | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <WarningAmberIcon color="error" /> {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={pending}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
