import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import SaveIcon from "@mui/icons-material/Save";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { getLateFeeRule, setLateFeeRule } from "../../../api/feeCollection";

export function FeeSettingPage() {
  const qc = useQueryClient();

  const ruleQuery = useQuery({
    queryKey: ["late-fee-rule"],
    queryFn: getLateFeeRule,
  });

  const [graceDays, setGraceDays] = useState(10);
  const [amount, setAmount] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ruleQuery.data) {
      setGraceDays(ruleQuery.data.grace_days ?? 10);
      setAmount(ruleQuery.data.amount ?? 0);
      setIsActive(ruleQuery.data.is_active ?? true);
    }
  }, [ruleQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      setLateFeeRule({ amount, grace_days: graceDays, is_active: isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["late-fee-rule"] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => setError("Failed to save late fee settings."),
  });

  return (
    <AppShell title="Fee Settings" navItems={adminNavItems}>
      <Stack direction="row" spacing={1} alignItems="center" mb={4}>
        <SettingsIcon color="primary" />
        <Typography variant="h4">Fee Settings</Typography>
      </Stack>

      <Card variant="outlined" sx={{ maxWidth: 560, borderRadius: 2 }}>
        <CardHeader
          title="Late Fee Rule"
          subheader="Automatically apply a fixed late fee surcharge when a challan is overdue past the grace period."
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {isActive ? "Enabled" : "Disabled"}
              </Typography>
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                color="primary"
              />
            </Stack>
          }
        />
        <Divider />
        <CardContent>
          {saved && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Late fee settings saved successfully.
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Stack spacing={3}>
            <TextField
              label="Grace Period"
              type="number"
              value={graceDays}
              onChange={(e) => setGraceDays(Number(e.target.value))}
              InputProps={{
                endAdornment: <InputAdornment position="end">days after due date</InputAdornment>,
                inputProps: { min: 0, max: 90 },
              }}
              helperText="No late fee is charged within this many days after the challan due date."
              fullWidth
              disabled={!isActive}
            />

            <TextField
              label="Late Fee Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              InputProps={{
                startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                inputProps: { min: 0, step: 10 },
              }}
              helperText="Fixed amount added to each overdue challan after the grace period."
              fullWidth
              disabled={!isActive}
            />

            {isActive && (
              <Typography variant="body2" color="text.secondary">
                <strong>Summary:</strong> After a {graceDays}-day grace period, PKR {amount.toLocaleString()} will be added to each overdue challan.
              </Typography>
            )}

            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || ruleQuery.isLoading}
              sx={{ alignSelf: "flex-start" }}
            >
              {saveMutation.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </AppShell>
  );
}
