import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listClasses } from "../../../api/classes";
import { listStudents, type Student } from "../../../api/students";
import {
  createInvoice,
  generateInvoices,
  listInvoices,
  type Invoice,
  type InvoiceStatus,
  type InvoiceType,
} from "../../../api/fees";

const STATUS_COLORS: Record<InvoiceStatus, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  paid: "success",
  overdue: "error",
  waived: "default",
};

function GenerateInvoicesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(String(new Date().getMonth() + 1));
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () =>
      generateInvoices({
        class_grade_id: classGradeId,
        period_month: Number(periodMonth),
        period_year: Number(periodYear),
        due_date: dueDate,
      }),
    onSuccess: (created) => {
      setError(null);
      setMessage(`Generated ${created.length} invoice(s).`);
      queryClient.invalidateQueries({ queryKey: ["fees-invoices"] });
    },
    onError: () => {
      setMessage(null);
      setError("Could not generate invoices — make sure a fee plan exists for this class.");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Generate monthly invoices</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          generate.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <FormControl fullWidth required>
              <InputLabel id="gen-class-label">Class</InputLabel>
              <Select
                labelId="gen-class-label"
                label="Class"
                value={classGradeId}
                onChange={(e) => setClassGradeId(e.target.value)}
              >
                {classesQuery.data?.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Month"
                type="number"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                required
                fullWidth
                slotProps={{ htmlInput: { min: 1, max: 12 } }}
              />
              <TextField
                label="Year"
                type="number"
                value={periodYear}
                onChange={(e) => setPeriodYear(e.target.value)}
                required
                fullWidth
              />
            </Stack>
            <TextField
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {message && <Alert severity="success">{message}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Close</Button>
          <Button type="submit" variant="contained" disabled={generate.isPending || !classGradeId}>
            Generate
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function SingleInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const studentsQuery = useQuery({
    queryKey: ["students", "search-fees", search],
    queryFn: () => listStudents({ query: search || undefined, status: "active" }),
  });
  const [student, setStudent] = useState<Student | null>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("admission");
  const [amountDue, setAmountDue] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createInvoice({
        student_id: student!.id,
        invoice_type: invoiceType,
        amount_due: Number(amountDue),
        due_date: dueDate,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      setStudent(null);
      setAmountDue("");
      setNotes("");
      setError(null);
      onClose();
      queryClient.invalidateQueries({ queryKey: ["fees-invoices"] });
    },
    onError: () => setError("Could not create invoice."),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create a one-off invoice</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <DialogContent>
          <Stack spacing={2}>
            <Autocomplete
              options={studentsQuery.data ?? []}
              getOptionLabel={(s) => s.full_name}
              value={student}
              onChange={(_, value) => setStudent(value)}
              onInputChange={(_, value) => setSearch(value)}
              renderInput={(params) => (
                <TextField {...params} label="Student" placeholder="Search by name" required />
              )}
            />
            <FormControl fullWidth required>
              <InputLabel id="invoice-type-label">Invoice type</InputLabel>
              <Select
                labelId="invoice-type-label"
                label="Invoice type"
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
              >
                <MenuItem value="admission">Admission</MenuItem>
                <MenuItem value="tuition">Tuition (one-off)</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Amount due (PKR)"
              type="number"
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={create.isPending || !student}>
            Create
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function InvoicesPage() {
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: listClasses });
  const [classGradeId, setClassGradeId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const invoicesQuery = useQuery({
    queryKey: ["fees-invoices", classGradeId, status],
    queryFn: () =>
      listInvoices({ classGradeId: classGradeId || undefined, status: (status || undefined) as InvoiceStatus | undefined }),
  });
  const classNameById = Object.fromEntries((classesQuery.data ?? []).map((c) => [c.id, c.name]));

  const [generateOpen, setGenerateOpen] = useState(false);
  const [singleOpen, setSingleOpen] = useState(false);

  return (
    <AppShell title="Invoices" navItems={adminNavItems}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}
      >
        <Typography variant="h4">Invoices</Typography>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" onClick={() => setSingleOpen(true)}>
            One-off invoice
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGenerateOpen(true)}>
            Generate monthly
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="filter-class-label">Class (optional)</InputLabel>
            <Select
              labelId="filter-class-label"
              label="Class (optional)"
              value={classGradeId}
              onChange={(e) => setClassGradeId(e.target.value)}
            >
              <MenuItem value="">All classes</MenuItem>
              {classesQuery.data?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="filter-status-label">Status (optional)</InputLabel>
            <Select
              labelId="filter-status-label"
              label="Status (optional)"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus | "")}
            >
              <MenuItem value="">All statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="waived">Waived</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {invoicesQuery.data?.length === 0 && <Alert severity="info">No invoices match these filters.</Alert>}

      {!!invoicesQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Net amount</TableCell>
                <TableCell>Due date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoicesQuery.data.map((inv: Invoice) => (
                <TableRow key={inv.id} hover>
                  <TableCell>{inv.invoice_number}</TableCell>
                  <TableCell>{classNameById[inv.class_grade_id] ?? "—"}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{inv.invoice_type}</TableCell>
                  <TableCell>{inv.period_month ? `${inv.period_month}/${inv.period_year}` : "—"}</TableCell>
                  <TableCell>PKR {inv.net_amount.toLocaleString()}</TableCell>
                  <TableCell>{inv.due_date}</TableCell>
                  <TableCell>
                    <Chip size="small" label={inv.status} color={STATUS_COLORS[inv.status]} sx={{ textTransform: "capitalize" }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <GenerateInvoicesDialog open={generateOpen} onClose={() => setGenerateOpen(false)} />
      <SingleInvoiceDialog open={singleOpen} onClose={() => setSingleOpen(false)} />
    </AppShell>
  );
}
