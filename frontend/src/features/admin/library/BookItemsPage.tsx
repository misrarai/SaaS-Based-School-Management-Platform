import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  InputAdornment,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { listAllCopies, type CopyStatus } from "../../../api/library";
import { CopyStatusChip } from "../../libraryShared";

const STATUSES: (CopyStatus | "all")[] = ["all", "available", "issued", "reserved", "lost", "damaged"];

export function BookItemsPage() {
  const [status, setStatus] = useState<CopyStatus | "all">("all");
  const [q, setQ] = useState("");

  const copies = useQuery({
    queryKey: ["library", "copies", status, q],
    queryFn: () => listAllCopies({ status: status === "all" ? undefined : status, q: q || undefined }),
  });

  return (
    <AppShell title="Library — Book Items" navItems={adminNavItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>Book Items (Copies)</Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value as CopyStatus | "all")}
          sx={{ minWidth: 150 }}
        >
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s === "all" ? "All statuses" : s}</MenuItem>)}
        </TextField>
        <TextField
          size="small" placeholder="Search accession / barcode" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 240 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <Typography variant="body2" color="text.secondary">{copies.data?.length ?? 0} copies</Typography>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={darkTableHeadSx}>
            <TableRow>
              <TableCell>Accession #</TableCell>
              <TableCell>Barcode</TableCell>
              <TableCell>Book</TableCell>
              <TableCell>Author</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {copies.isLoading ? (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            ) : (copies.data?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No copies found.</TableCell></TableRow>
            ) : (
              copies.data!.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.accession_number}</TableCell>
                  <TableCell>{c.barcode || "—"}</TableCell>
                  <TableCell>{c.book_title || "—"}</TableCell>
                  <TableCell>{c.book_author || "—"}</TableCell>
                  <TableCell><CopyStatusChip status={c.status} /></TableCell>
                  <TableCell>{c.notes || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </AppShell>
  );
}
