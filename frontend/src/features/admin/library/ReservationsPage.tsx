import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import {
  cancelReservation,
  createReservation,
  libraryErrorMessage,
  listLibraryMembers,
  listReservations,
  searchBooks,
  type Book,
  type LibraryMember,
} from "../../../api/library";
import { ReservationsTable, libraryAdminNav, withLibraryNav } from "../../libraryShared";

const navItems = withLibraryNav(adminNavItems, libraryAdminNav);

type Filter = "active" | "ready" | "pending" | "fulfilled" | "cancelled" | "expired" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "ready", label: "Ready for pickup" },
  { key: "pending", label: "Waiting" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
];

export function LibraryReservationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active");
  const [error, setError] = useState<string | null>(null);
  const reservationsQuery = useQuery({
    queryKey: ["library", "reservations", filter],
    queryFn: () => listReservations(filter),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["library"] });
  const cancel = useMutation({
    mutationFn: cancelReservation,
    onSuccess: refresh,
    onError: (err) => setError(libraryErrorMessage(err, "Could not cancel reservation.")),
  });

  const [open, setOpen] = useState(false);
  const [book, setBook] = useState<Book | null>(null);
  const [member, setMember] = useState<LibraryMember | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const booksQuery = useQuery({ queryKey: ["library", "books", "", ""], queryFn: () => searchBooks(), enabled: open });
  const membersQuery = useQuery({ queryKey: ["library", "members", "all"], queryFn: () => listLibraryMembers(), enabled: open });
  const create = useMutation({
    mutationFn: () => createReservation({ book_id: book!.id, member_id: member!.id }),
    onSuccess: () => {
      setOpen(false);
      setBook(null);
      setMember(null);
      setDialogError(null);
      refresh();
    },
    onError: (err) => setDialogError(libraryErrorMessage(err, "Could not place reservation.")),
  });

  return (
    <AppShell title="Library" navItems={navItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4">Reservations</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          New reservation
        </Button>
      </Stack>
      <Stack direction="row" sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        {FILTERS.map(({ key, label }) => {
          const selected = key === filter;
          return (
            <Button
              key={key}
              onClick={() => setFilter(key)}
              variant={selected ? "contained" : "outlined"}
              size="small"
              sx={{
                borderRadius: 1,
                bgcolor: selected ? "#0e3550" : "#fff",
                color: selected ? "#fff" : "text.primary",
                borderColor: "#d0d5dd",
                "&:hover": { bgcolor: selected ? "#0e3550" : "#f5f5f5", borderColor: "#d0d5dd" },
              }}
            >
              {label}
            </Button>
          );
        })}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        When a reserved book is returned, the copy is held for the oldest waiting reservation, which becomes "ready".
        Issue it from the desk to the reserving member before the collect-by date.
      </Typography>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {reservationsQuery.isLoading ? (
        <Typography>Loading…</Typography>
      ) : (
        <ReservationsTable
          reservations={reservationsQuery.data ?? []}
          actions={(r) =>
            r.status === "pending" || r.status === "ready" ? (
              <Button size="small" color="error" onClick={() => cancel.mutate(r.id)}>
                Cancel
              </Button>
            ) : null
          }
        />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Reserve a book for a member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              options={(booksQuery.data ?? []).filter((b) => b.available_copies === 0 && b.total_copies > 0)}
              value={book}
              onChange={(_, v) => setBook(v)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              getOptionLabel={(b) => `${b.title}${b.author ? ` — ${b.author}` : ""}`}
              renderInput={(params) => (
                <TextField {...params} label="Book (no copies available)" required helperText="Only books with every copy out are listed" />
              )}
            />
            <Autocomplete
              options={(membersQuery.data ?? []).filter((m) => m.status === "active")}
              value={member}
              onChange={(_, v) => setMember(v)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              getOptionLabel={(m) => `${m.full_name} (${m.card_number})`}
              renderInput={(params) => <TextField {...params} label="Member" required />}
            />
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!book || !member || create.isPending} onClick={() => create.mutate()}>
            Reserve
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
