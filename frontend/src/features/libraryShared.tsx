import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import LocalLibraryIcon from "@mui/icons-material/LocalLibraryOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { AppShell, type NavItem } from "../components/AppShell";
import { darkTableHeadSx } from "../components/tableStyles";
import {
  cancelReservation,
  getMyLibrary,
  libraryErrorMessage,
  listBookCategories,
  renewMyIssue,
  reserveBookForMe,
  searchBooks,
  type BookIssue,
  type CopyStatus,
  type FineStatus,
  type Reservation,
  type ReservationStatus,
} from "../api/library";

// ------------------------------------------------------------------ navigation
export const libraryAdminNav: NavItem = {
  label: "Library",
  to: "/admin/library",
  icon: <LocalLibraryIcon fontSize="small" />,
  children: [
    { label: "Catalogue", to: "/admin/library" },
    { label: "Issue / Return Desk", to: "/admin/library/circulation" },
    { label: "Reservations", to: "/admin/library/reservations" },
    { label: "Overdue & Fines", to: "/admin/library/fines" },
    { label: "Library Settings", to: "/admin/library/settings" },
  ],
};

export const libraryStudentNav: NavItem = {
  label: "Library",
  to: "/student/library",
  icon: <LocalLibraryIcon fontSize="small" />,
};

export const libraryTeacherNav: NavItem = {
  label: "Library",
  to: "/teacher/library",
  icon: <LocalLibraryIcon fontSize="small" />,
};

export const libraryParentNav: NavItem = {
  label: "Library",
  to: "/parent/library",
  icon: <LocalLibraryIcon fontSize="small" />,
};

/** Adds the library entry to a role's nav unless it was already wired into that nav file. */
export function withLibraryNav(base: NavItem[], item: NavItem): NavItem[] {
  return base.some((n) => n.to === item.to) ? base : [...base, item];
}

// --------------------------------------------------------------------- helpers
export function formatMoney(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const COPY_COLORS: Record<CopyStatus, "success" | "info" | "error" | "warning" | "secondary"> = {
  available: "success",
  issued: "info",
  lost: "error",
  damaged: "warning",
  reserved: "secondary",
};

export function CopyStatusChip({ status }: { status: CopyStatus }) {
  return <Chip size="small" label={status} color={COPY_COLORS[status] ?? "default"} />;
}

export function FineChip({ status, amount }: { status: FineStatus; amount: number }) {
  if (status === "none") return <Typography variant="body2" color="text.secondary">—</Typography>;
  const color = status === "paid" ? "success" : status === "waived" ? "default" : "error";
  return <Chip size="small" color={color} label={`${formatMoney(amount)} · ${status}`} />;
}

export function ReservationChip({ status }: { status: ReservationStatus }) {
  const color =
    status === "ready" ? "success" : status === "pending" ? "warning" : status === "fulfilled" ? "info" : "default";
  return <Chip size="small" color={color} label={status} />;
}

export function IssueStatusChip({ issue }: { issue: BookIssue }) {
  if (issue.status === "issued") {
    return issue.is_overdue ? (
      <Chip size="small" color="error" label={`Overdue ${issue.days_overdue}d`} />
    ) : (
      <Chip size="small" color="info" label="Issued" />
    );
  }
  return <Chip size="small" color={issue.status === "lost" ? "error" : "success"} label={issue.status} />;
}

export function IssuesTable({
  issues,
  showMember = true,
  actions,
  emptyText = "No records.",
}: {
  issues: BookIssue[];
  showMember?: boolean;
  actions?: (issue: BookIssue) => ReactNode;
  emptyText?: string;
}) {
  if (!issues.length) return <Alert severity="info">{emptyText}</Alert>;
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead sx={darkTableHeadSx}>
          <TableRow>
            <TableCell>Book</TableCell>
            <TableCell>Acc. No.</TableCell>
            {showMember && <TableCell>Member</TableCell>}
            <TableCell>Issued</TableCell>
            <TableCell>Due</TableCell>
            <TableCell>Returned</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Fine</TableCell>
            {actions && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {issues.map((i) => (
            <TableRow key={i.id} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {i.book_title}
                </Typography>
                {i.book_author && (
                  <Typography variant="caption" color="text.secondary">
                    {i.book_author}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{i.accession_number}</TableCell>
              {showMember && (
                <TableCell>
                  {i.member_name}
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {i.card_number} · {i.member_type}
                  </Typography>
                </TableCell>
              )}
              <TableCell>{i.issued_on}</TableCell>
              <TableCell>
                {i.due_date}
                {i.renewals_count > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    renewed ×{i.renewals_count}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{i.returned_on ?? "—"}</TableCell>
              <TableCell>
                <IssueStatusChip issue={i} />
              </TableCell>
              <TableCell>
                <FineChip status={i.fine_status} amount={i.fine_amount} />
              </TableCell>
              {actions && <TableCell align="right">{actions(i)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function ReservationsTable({
  reservations,
  showMember = true,
  actions,
  emptyText = "No reservations.",
}: {
  reservations: Reservation[];
  showMember?: boolean;
  actions?: (r: Reservation) => ReactNode;
  emptyText?: string;
}) {
  if (!reservations.length) return <Alert severity="info">{emptyText}</Alert>;
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead sx={darkTableHeadSx}>
          <TableRow>
            <TableCell>Book</TableCell>
            {showMember && <TableCell>Member</TableCell>}
            <TableCell>Reserved</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Queue / Held copy</TableCell>
            <TableCell>Collect by</TableCell>
            {actions && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {reservations.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell>{r.book_title}</TableCell>
              {showMember && (
                <TableCell>
                  {r.member_name}
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {r.card_number}
                  </Typography>
                </TableCell>
              )}
              <TableCell>{new Date(r.reserved_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <ReservationChip status={r.status} />
              </TableCell>
              <TableCell>
                {r.status === "ready" ? `Copy ${r.accession_number}` : r.queue_position ? `#${r.queue_position} in queue` : "—"}
              </TableCell>
              <TableCell>{r.expires_on ?? "—"}</TableCell>
              {actions && <TableCell align="right">{actions(r)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 150, flex: "1 1 150px" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: tone }}>
        {value}
      </Typography>
    </Paper>
  );
}

// ------------------------------------------------------------ catalogue browse
export function CatalogueBrowser({ onReserve, reservingId }: { onReserve?: (bookId: string) => void; reservingId?: string | null }) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categoriesQuery = useQuery({ queryKey: ["library", "categories"], queryFn: listBookCategories });
  const booksQuery = useQuery({
    queryKey: ["library", "books", search, categoryId],
    queryFn: () => searchBooks({ q: search || undefined, categoryId: categoryId || undefined }),
  });

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            size="small"
            placeholder="Search title, author, ISBN, category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 340, maxWidth: "100%" }}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            }}
          />
          <TextField
            select
            size="small"
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All categories</MenuItem>
            {(categoriesQuery.data ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>
      {booksQuery.isLoading && <Typography>Loading…</Typography>}
      {booksQuery.data?.length === 0 && <Alert severity="info">No books match your search.</Alert>}
      {!!booksQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>ISBN</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Availability</TableCell>
                {onReserve && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {booksQuery.data.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {b.title}
                    </Typography>
                    {b.edition && (
                      <Typography variant="caption" color="text.secondary">
                        {b.edition} edition
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{b.author ?? "—"}</TableCell>
                  <TableCell>{b.category_name ?? "—"}</TableCell>
                  <TableCell>{b.isbn ?? "—"}</TableCell>
                  <TableCell>{b.rack_location ?? "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={b.available_copies > 0 ? "success" : "default"}
                      label={`${b.available_copies} / ${b.total_copies} available`}
                    />
                  </TableCell>
                  {onReserve && (
                    <TableCell align="right">
                      {b.available_copies === 0 && b.issued_copies + b.reserved_copies > 0 ? (
                        <Button size="small" disabled={reservingId === b.id} onClick={() => onReserve(b.id)}>
                          Reserve
                        </Button>
                      ) : b.available_copies > 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          Ask at the desk
                        </Typography>
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}

// ------------------------------------------------------ student/teacher portal
export function BorrowerLibraryView({ navItems }: { navItems: NavItem[] }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const myQuery = useQuery({ queryKey: ["library", "me"], queryFn: getMyLibrary });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["library"] });
  const reserve = useMutation({
    mutationFn: reserveBookForMe,
    onSuccess: () => {
      setMessage({ severity: "success", text: "Reserved. We'll hold a copy for you when one is returned." });
      refresh();
    },
    onError: (err) => setMessage({ severity: "error", text: libraryErrorMessage(err, "Could not reserve this book.") }),
  });
  const cancel = useMutation({
    mutationFn: cancelReservation,
    onSuccess: refresh,
    onError: (err) => setMessage({ severity: "error", text: libraryErrorMessage(err, "Could not cancel.") }),
  });
  const renew = useMutation({
    mutationFn: renewMyIssue,
    onSuccess: () => {
      setMessage({ severity: "success", text: "Book renewed." });
      refresh();
    },
    onError: (err) => setMessage({ severity: "error", text: libraryErrorMessage(err, "Could not renew.") }),
  });

  const data = myQuery.data;
  const current = data?.issues.filter((i) => i.status === "issued") ?? [];
  const history = data?.issues.filter((i) => i.status !== "issued") ?? [];

  return (
    <AppShell title="Library" navItems={navItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Library
      </Typography>
      {data && (
        <Stack direction="row" sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}>
          <StatTile label="Card number" value={data.member?.card_number ?? "Not registered"} />
          <StatTile label="Books with me" value={`${current.length} / ${data.max_books}`} />
          <StatTile label="Loan period" value={`${data.loan_days} days`} />
          <StatTile
            label="Outstanding fine"
            value={formatMoney(data.outstanding_fine)}
            tone={data.outstanding_fine > 0 ? "error.main" : undefined}
          />
        </Stack>
      )}
      {message && (
        <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Browse catalogue" />
        <Tab label={`My books (${current.length})`} />
        <Tab label="Reservations" />
        <Tab label="History & fines" />
      </Tabs>
      {tab === 0 && (
        <CatalogueBrowser
          onReserve={(id) => reserve.mutate(id)}
          reservingId={reserve.isPending ? (reserve.variables ?? null) : null}
        />
      )}
      {tab === 1 && (
        <IssuesTable
          issues={current}
          showMember={false}
          emptyText="You have no books issued right now."
          actions={(i) =>
            !i.is_overdue ? (
              <Button size="small" disabled={renew.isPending} onClick={() => renew.mutate(i.id)}>
                Renew
              </Button>
            ) : null
          }
        />
      )}
      {tab === 2 && (
        <ReservationsTable
          reservations={data?.reservations ?? []}
          showMember={false}
          emptyText="You have no reservations."
          actions={(r) =>
            r.status === "pending" || r.status === "ready" ? (
              <Button size="small" color="error" onClick={() => cancel.mutate(r.id)}>
                Cancel
              </Button>
            ) : null
          }
        />
      )}
      {tab === 3 && <IssuesTable issues={history} showMember={false} emptyText="No past borrowing yet." />}
    </AppShell>
  );
}
