import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses } from "../../../api/classes";
import { generateStructuredInvoices, type GenerateResult } from "../../../api/feeCollection";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function CreateChallanPage() {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });

  const today = new Date();
  const [scope, setScope] = useState<"all" | "single">("all");
  const [classGradeId, setClassGradeId] = useState("");
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 10);
    return d.toISOString().split("T")[0];
  });
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classes = classesQuery.data ?? [];
  const targetClasses = scope === "all" ? classes : classes.filter((c) => c.id === classGradeId);

  const generate = useMutation({
    mutationFn: async () => {
      const results: GenerateResult[] = [];
      const skippedClasses: string[] = [];
      for (const cls of targetClasses) {
        try {
          const r = await generateStructuredInvoices({
            class_grade_id: cls.id,
            period_month: month,
            period_year: year,
            due_date: dueDate,
          });
          results.push(r);
        } catch {
          // Class has no structure or no monthly heads — skip it, don't fail the whole batch
          skippedClasses.push(cls.name);
        }
      }
      if (results.length === 0 && skippedClasses.length > 0) {
        throw new Error(`No fee structure with monthly amounts found for: ${skippedClasses.join(", ")}. Go to Fee → Fee Structure, set at least one MONTHLY fee head with an amount, then try again.`);
      }
      const combined = results.reduce<GenerateResult>(
        (acc, r) => ({
          invoices_created: acc.invoices_created + r.invoices_created,
          skipped_existing: acc.skipped_existing + r.skipped_existing,
          invoices: [...acc.invoices, ...r.invoices],
        }),
        { invoices_created: 0, skipped_existing: 0, invoices: [] }
      );
      if (skippedClasses.length > 0) {
        combined.skipped_classes = skippedClasses;
      }
      return combined;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["fee-collection-invoices"] });
    },
    onError: (err: Error) => setError(err.message || "Failed to generate challans. Please check fee structure."),
  });

  const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

  return (
    <AppShell title="Create Challan" navItems={adminNavItems}>
      <Typography variant="h4" mb={3}>Create Monthly Fee Challan</Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Typography variant="h6" mb={2}>Step 1 — Select Category</Typography>
        <Stack spacing={3}>
          <FormControl fullWidth>
            <InputLabel>Challan Type</InputLabel>
            <Select value="monthly" label="Challan Type">
              <MenuItem value="monthly">Create Monthly Fee Challan</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Scope</InputLabel>
            <Select value={scope} label="Scope" onChange={(e) => setScope(e.target.value as "all" | "single")}>
              <MenuItem value="all">All Classes</MenuItem>
              <MenuItem value="single">A Single Class</MenuItem>
            </Select>
          </FormControl>

          {scope === "single" && (
            <FormControl fullWidth required>
              <InputLabel>Class</InputLabel>
              <Select value={classGradeId} label="Class" onChange={(e) => setClassGradeId(e.target.value)}>
                {classes.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Month</InputLabel>
              <Select value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Year</InputLabel>
              <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => generate.mutate()}
              disabled={generate.isPending || (scope === "single" && !classGradeId)}
            >
              {generate.isPending ? "Generating…" : "Create Challans"}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {result && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" mb={2} flexWrap="wrap">
            <CheckCircleIcon color="success" />
            <Typography variant="h6">
              Challans Generated
            </Typography>
            <Chip label={`${result.invoices_created} created`} color="success" />
            {result.skipped_existing > 0 && (
              <Chip label={`${result.skipped_existing} skipped (already existed)`} color="warning" />
            )}
            {result.skipped_classes && result.skipped_classes.length > 0 && (
              <Chip label={`${result.skipped_classes.join(", ")} skipped (no structure)`} color="default" />
            )}
          </Stack>

          {result.invoices.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead sx={darkTableHeadSx}>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Admission #</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.invoices.map((inv) => (
                    <TableRow key={inv.id} hover>
                      <TableCell>{inv.student_name}</TableCell>
                      <TableCell>{inv.admission_number ?? "—"}</TableCell>
                      <TableCell>{inv.class_grade_name}</TableCell>
                      <TableCell>{inv.invoice_number}</TableCell>
                      <TableCell align="right">{fmt(inv.net_amount)}</TableCell>
                      <TableCell>{inv.due_date}</TableCell>
                      <TableCell>
                        <Chip label={inv.status} size="small" color={inv.status === "paid" ? "success" : "default"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}
    </AppShell>
  );
}
