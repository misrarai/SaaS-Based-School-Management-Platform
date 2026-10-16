import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses } from "../../../api/classes";
import {
  listFeeHeads,
  getFeeStructure,
  setFeeStructure,
  type FeeFrequency,
} from "../../../api/feeCollection";

const FREQ_LABELS: Record<FeeFrequency, string> = {
  monthly: "Monthly",
  per_term: "Per Term",
  annual: "Annually",
  one_time: "One-Time",
};

interface RowState {
  fee_head_id: string;
  fee_head_name: string;
  amount: string;
  frequency: FeeFrequency;
  enabled: boolean;
}

export function FeeStructurePage() {
  const qc = useQueryClient();
  const [classGradeId, setClassGradeId] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const headsQuery = useQuery({ queryKey: ["fee-heads"], queryFn: () => listFeeHeads(true) });

  const structureQuery = useQuery({
    queryKey: ["fee-structure", classGradeId],
    queryFn: () => getFeeStructure(classGradeId),
    enabled: !!classGradeId,
  });

  // When class or fee heads load, merge into row state
  useEffect(() => {
    const heads = headsQuery.data ?? [];
    if (!heads.length) return;

    const existing = structureQuery.data?.items ?? [];
    const existingMap = new Map(existing.map((i) => [i.fee_head_id, i]));

    setRows(
      heads.map((h) => {
        const ex = existingMap.get(h.id);
        return {
          fee_head_id: h.id,
          fee_head_name: h.name,
          amount: ex ? String(ex.amount) : "",
          frequency: ex ? ex.frequency : (h.default_frequency ?? "monthly"),
          enabled: !!ex,
        };
      })
    );
  }, [headsQuery.data, structureQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = rows
        .filter((r) => r.enabled && r.amount !== "" && Number(r.amount) > 0)
        .map((r) => ({
          fee_head_id: r.fee_head_id,
          amount: Number(r.amount),
          frequency: r.frequency,
        }));
      return setFeeStructure(classGradeId, items);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-structure", classGradeId] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => setError("Failed to save fee structure. Please try again."),
  });

  const updateRow = (id: string, field: keyof RowState, value: string | boolean | FeeFrequency) => {
    setRows((prev) => prev.map((r) => (r.fee_head_id === id ? { ...r, [field]: value } : r)));
  };

  const monthlyTotal = rows
    .filter((r) => r.enabled && r.frequency === "monthly" && Number(r.amount) > 0)
    .reduce((s, r) => s + Number(r.amount), 0);

  const classes = classesQuery.data ?? [];
  const heads = headsQuery.data ?? [];
  const selectedClass = classes.find((c) => c.id === classGradeId);

  return (
    <AppShell title="Fee Structure" navItems={adminNavItems}>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <AccountTreeIcon color="primary" />
        <Typography variant="h4">Fee Structure</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Set the monthly fee amounts for each class. This is required before generating fee challans.
        Select a class, enable the fee heads that apply, enter amounts, then save.
      </Typography>

      {/* Class selector */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 240 }} required>
            <InputLabel>Select Class *</InputLabel>
            <Select
              value={classGradeId}
              label="Select Class *"
              onChange={(e) => {
                setClassGradeId(e.target.value);
                setSaved(false);
                setError(null);
              }}
            >
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedClass && structureQuery.data && (
            <Chip
              label={`Monthly total: PKR ${monthlyTotal.toLocaleString()}`}
              color="primary"
              variant="outlined"
            />
          )}
        </Stack>
      </Paper>

      {!classGradeId && (
        <Box textAlign="center" py={6}>
          <AccountTreeIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">Select a class above to view and edit its fee structure.</Typography>
        </Box>
      )}

      {classGradeId && heads.length === 0 && (
        <Alert severity="warning">
          No fee heads found. Go to <strong>Fee Heads</strong> first and create or seed the default fee heads.
        </Alert>
      )}

      {classGradeId && heads.length > 0 && (
        <>
          {saved && <Alert severity="success" sx={{ mb: 2 }}>Fee structure saved for {selectedClass?.name}.</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

          {structureQuery.data?.items.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No fee structure set for <strong>{selectedClass?.name}</strong> yet.
              Enable the fee heads below and enter amounts, then click Save.
            </Alert>
          )}

          <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
            <Table size="small">
              <TableHead sx={darkTableHeadSx}>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ pl: 2 }}>Enable</TableCell>
                  <TableCell>Fee Head</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>Amount (PKR)</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Frequency</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.fee_head_id}
                    hover
                    sx={{ opacity: row.enabled ? 1 : 0.45 }}
                  >
                    <TableCell padding="checkbox" sx={{ pl: 2 }}>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => updateRow(row.fee_head_id, "enabled", e.target.checked)}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: row.enabled ? 600 : 400 }}>
                      {row.fee_head_name}
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={row.amount}
                        onChange={(e) => updateRow(row.fee_head_id, "amount", e.target.value)}
                        disabled={!row.enabled}
                        placeholder="0"
                        InputProps={{
                          startAdornment: <InputAdornment position="start">PKR</InputAdornment>,
                          inputProps: { min: 0, step: 50 },
                        }}
                        sx={{ maxWidth: 180 }}
                      />
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" disabled={!row.enabled} sx={{ minWidth: 140 }}>
                        <Select
                          value={row.frequency}
                          onChange={(e) => updateRow(row.fee_head_id, "frequency", e.target.value as FeeFrequency)}
                        >
                          {Object.entries(FREQ_LABELS).map(([k, v]) => (
                            <MenuItem key={k} value={k}>{v}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {/* Summary */}
          {rows.some((r) => r.enabled && Number(r.amount) > 0) && (
            <Card variant="outlined" sx={{ mb: 3, borderRadius: 2, maxWidth: 400 }}>
              <CardContent>
                <Typography variant="subtitle2" mb={1}>Fee Summary — {selectedClass?.name}</Typography>
                {rows.filter((r) => r.enabled && Number(r.amount) > 0).map((r) => (
                  <Stack key={r.fee_head_id} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{r.fee_head_name}</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      PKR {Number(r.amount).toLocaleString()} / {FREQ_LABELS[r.frequency]}
                    </Typography>
                  </Stack>
                ))}
                <Stack direction="row" justifyContent="space-between" mt={1} pt={1} sx={{ borderTop: 1, borderColor: "divider" }}>
                  <Typography variant="body2" fontWeight={700}>Monthly Total</Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    PKR {monthlyTotal.toLocaleString()}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Button
            variant="contained"
            size="large"
            startIcon={<SaveIcon />}
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !classGradeId}
          >
            {saveMutation.isPending ? "Saving…" : `Save Structure for ${selectedClass?.name ?? "Class"}`}
          </Button>
        </>
      )}
    </AppShell>
  );
}
