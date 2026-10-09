import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
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
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { AppShell } from "../../../components/AppShell";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { adminNavItems } from "../adminNav";
import {
  addBookCopies,
  createBook,
  createBookCategory,
  deleteBook,
  deleteBookCategory,
  deleteBookCopy,
  getBook,
  getLibrarySummary,
  libraryErrorMessage,
  listBookCategories,
  searchBooks,
  updateBook,
  updateBookCopy,
  type Book,
  type BookFields,
} from "../../../api/library";
import { CopyStatusChip, StatTile, formatMoney, libraryAdminNav, withLibraryNav } from "../../libraryShared";

const navItems = withLibraryNav(adminNavItems, libraryAdminNav);

type BookForm = Record<keyof BookFields, string> & { copies: string };

const EMPTY_FORM: BookForm = {
  title: "",
  isbn: "",
  author: "",
  publisher: "",
  edition: "",
  category_id: "",
  subject: "",
  rack_location: "",
  price: "",
  purchase_date: "",
  language: "",
  description: "",
  copies: "1",
};

function formFromBook(b: Book): BookForm {
  const s = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  return {
    title: b.title,
    isbn: s(b.isbn),
    author: s(b.author),
    publisher: s(b.publisher),
    edition: s(b.edition),
    category_id: s(b.category_id),
    subject: s(b.subject),
    rack_location: s(b.rack_location),
    price: s(b.price),
    purchase_date: s(b.purchase_date),
    language: s(b.language),
    description: s(b.description),
    copies: "0",
  };
}

function payloadFromForm(f: BookForm): BookFields {
  const n = (v: string) => (v.trim() ? v.trim() : null);
  return {
    title: f.title.trim(),
    isbn: n(f.isbn),
    author: n(f.author),
    publisher: n(f.publisher),
    edition: n(f.edition),
    category_id: n(f.category_id),
    subject: n(f.subject),
    rack_location: n(f.rack_location),
    price: f.price ? Number(f.price) : null,
    purchase_date: n(f.purchase_date),
    language: n(f.language),
    description: n(f.description),
  };
}

export function LibraryCataloguePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const summaryQuery = useQuery({ queryKey: ["library", "summary"], queryFn: getLibrarySummary });
  const categoriesQuery = useQuery({ queryKey: ["library", "categories"], queryFn: listBookCategories });
  const booksQuery = useQuery({
    queryKey: ["library", "books", search, categoryFilter],
    queryFn: () => searchBooks({ q: search || undefined, categoryId: categoryFilter || undefined }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["library"] });

  // Book dialog
  const [bookDialog, setBookDialog] = useState<{ open: boolean; editing: Book | null }>({ open: false, editing: null });
  const [form, setForm] = useState<BookForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const setField = (k: keyof BookForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const saveBook = useMutation({
    mutationFn: () =>
      bookDialog.editing
        ? updateBook(bookDialog.editing.id, payloadFromForm(form))
        : createBook({ ...payloadFromForm(form), copies: Number(form.copies || 0) }),
    onSuccess: () => {
      setBookDialog({ open: false, editing: null });
      refresh();
    },
    onError: (err) => setFormError(libraryErrorMessage(err, "Could not save the book.")),
  });

  const removeBook = useMutation({
    mutationFn: (id: string) => deleteBook(id),
    onSuccess: refresh,
    onError: (err) => setError(libraryErrorMessage(err, "Could not delete the book.")),
  });

  // Categories dialog
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catError, setCatError] = useState<string | null>(null);
  const addCategory = useMutation({
    mutationFn: () => createBookCategory({ name: catName }),
    onSuccess: () => {
      setCatName("");
      setCatError(null);
      refresh();
    },
    onError: (err) => setCatError(libraryErrorMessage(err, "Could not add category.")),
  });
  const removeCategory = useMutation({
    mutationFn: (id: string) => deleteBookCategory(id),
    onSuccess: refresh,
    onError: (err) => setCatError(libraryErrorMessage(err, "Could not delete category.")),
  });

  // Copies dialog
  const [copiesBookId, setCopiesBookId] = useState<string | null>(null);
  const [newAccession, setNewAccession] = useState("");
  const [newBarcode, setNewBarcode] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [copyError, setCopyError] = useState<string | null>(null);
  const bookDetailQuery = useQuery({
    queryKey: ["library", "book", copiesBookId],
    queryFn: () => getBook(copiesBookId as string),
    enabled: !!copiesBookId,
  });
  const addCopies = useMutation({
    mutationFn: () =>
      addBookCopies(copiesBookId as string, {
        accession_number: newAccession || undefined,
        barcode: newBarcode || undefined,
        quantity: newAccession ? 1 : Number(newQty || 1),
      }),
    onSuccess: () => {
      setNewAccession("");
      setNewBarcode("");
      setNewQty("1");
      setCopyError(null);
      refresh();
    },
    onError: (err) => setCopyError(libraryErrorMessage(err, "Could not add copies.")),
  });
  const changeCopy = useMutation({
    mutationFn: (vars: { id: string; status: "available" | "lost" | "damaged" }) =>
      updateBookCopy(vars.id, { status: vars.status }),
    onSuccess: refresh,
    onError: (err) => setCopyError(libraryErrorMessage(err, "Could not update copy.")),
  });
  const removeCopy = useMutation({
    mutationFn: (id: string) => deleteBookCopy(id),
    onSuccess: refresh,
    onError: (err) => setCopyError(libraryErrorMessage(err, "Could not delete copy.")),
  });

  const summary = summaryQuery.data;

  return (
    <AppShell title="Library" navItems={navItems}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4">Book Catalogue</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setCatOpen(true)}>
            Categories
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setForm(EMPTY_FORM);
              setFormError(null);
              setBookDialog({ open: true, editing: null });
            }}
          >
            Add book
          </Button>
        </Stack>
      </Stack>

      {summary && (
        <Stack direction="row" sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}>
          <StatTile label="Titles" value={summary.total_titles} />
          <StatTile label="Copies" value={summary.total_copies} />
          <StatTile label="Available" value={summary.available_copies} tone="success.main" />
          <StatTile label="Issued" value={summary.issued_copies} />
          <StatTile label="Overdue" value={summary.overdue_count} tone={summary.overdue_count ? "error.main" : undefined} />
          <StatTile label="Members" value={summary.total_members} />
        </Stack>
      )}

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
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          There are <strong>{booksQuery.data?.length ?? 0}</strong> titles in this view.
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {booksQuery.isLoading && <Typography>Loading…</Typography>}
      {booksQuery.data?.length === 0 && <Alert severity="info">No books yet — click "Add book" to start the catalogue.</Alert>}

      {!!booksQuery.data?.length && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author / Publisher</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>ISBN</TableCell>
                <TableCell>Rack</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Copies</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {booksQuery.data.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {b.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[b.edition && `${b.edition} ed.`, b.language, b.subject].filter(Boolean).join(" · ")}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {b.author ?? "—"}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {b.publisher}
                    </Typography>
                  </TableCell>
                  <TableCell>{b.category_name ?? "—"}</TableCell>
                  <TableCell>{b.isbn ?? "—"}</TableCell>
                  <TableCell>{b.rack_location ?? "—"}</TableCell>
                  <TableCell>{b.price != null ? formatMoney(b.price) : "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={b.available_copies > 0 ? "success" : "default"}
                      label={`${b.available_copies} / ${b.total_copies}`}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" onClick={() => setCopiesBookId(b.id)}>
                      Copies
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setForm(formFromBook(b));
                        setFormError(null);
                        setBookDialog({ open: true, editing: b });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        if (window.confirm(`Delete "${b.title}" and all its copies?`)) removeBook.mutate(b.id);
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add / edit book */}
      <Dialog open={bookDialog.open} onClose={() => setBookDialog({ open: false, editing: null })} fullWidth maxWidth="sm">
        <DialogTitle>{bookDialog.editing ? "Edit book" : "Add a book"}</DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            saveBook.mutate();
          }}
        >
          <DialogContent>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
              <TextField label="Title" value={form.title} onChange={setField("title")} required autoFocus sx={{ gridColumn: "1 / -1" }} />
              <TextField label="Author" value={form.author} onChange={setField("author")} />
              <TextField label="Publisher" value={form.publisher} onChange={setField("publisher")} />
              <TextField label="ISBN" value={form.isbn} onChange={setField("isbn")} />
              <TextField label="Edition" value={form.edition} onChange={setField("edition")} />
              <TextField select label="Category" value={form.category_id} onChange={setField("category_id")}>
                <MenuItem value="">— None —</MenuItem>
                {(categoriesQuery.data ?? []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Subject" value={form.subject} onChange={setField("subject")} />
              <TextField label="Rack / shelf" value={form.rack_location} onChange={setField("rack_location")} />
              <TextField label="Language" value={form.language} onChange={setField("language")} />
              <TextField label="Price" type="number" value={form.price} onChange={setField("price")} />
              <TextField
                label="Purchase date"
                type="date"
                value={form.purchase_date}
                onChange={setField("purchase_date")}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {!bookDialog.editing && (
                <TextField
                  label="Number of copies"
                  type="number"
                  value={form.copies}
                  onChange={setField("copies")}
                  helperText="Accession numbers are generated automatically"
                />
              )}
              <TextField
                label="Description"
                value={form.description}
                onChange={setField("description")}
                multiline
                minRows={2}
                sx={{ gridColumn: "1 / -1" }}
              />
            </Box>
            {formError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {formError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setBookDialog({ open: false, editing: null })}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveBook.isPending}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Categories */}
      <Dialog open={catOpen} onClose={() => setCatOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Book categories</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            direction="row"
            spacing={1}
            sx={{ mt: 1, mb: 2 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (catName.trim()) addCategory.mutate();
            }}
          >
            <TextField size="small" label="New category" value={catName} onChange={(e) => setCatName(e.target.value)} fullWidth />
            <Button type="submit" variant="contained" disabled={addCategory.isPending}>
              Add
            </Button>
          </Stack>
          {catError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {catError}
            </Alert>
          )}
          {(categoriesQuery.data ?? []).map((c) => (
            <Stack key={c.id} direction="row" sx={{ justifyContent: "space-between", alignItems: "center", py: 0.5 }}>
              <Typography variant="body2">
                {c.name}{" "}
                <Typography component="span" variant="caption" color="text.secondary">
                  ({c.book_count} books)
                </Typography>
              </Typography>
              <IconButton size="small" onClick={() => removeCategory.mutate(c.id)} aria-label={`Delete ${c.name}`}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          {categoriesQuery.data?.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No categories yet.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Copies */}
      <Dialog open={!!copiesBookId} onClose={() => setCopiesBookId(null)} fullWidth maxWidth="md">
        <DialogTitle>Copies — {bookDetailQuery.data?.title}</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            direction="row"
            sx={{ mt: 1, mb: 2, flexWrap: "wrap", gap: 1 }}
            onSubmit={(e) => {
              e.preventDefault();
              addCopies.mutate();
            }}
          >
            <TextField
              size="small"
              label="Accession no. (optional)"
              value={newAccession}
              onChange={(e) => setNewAccession(e.target.value)}
            />
            <TextField size="small" label="Barcode (optional)" value={newBarcode} onChange={(e) => setNewBarcode(e.target.value)} />
            <TextField
              size="small"
              label="Quantity"
              type="number"
              value={newAccession ? "1" : newQty}
              disabled={!!newAccession}
              onChange={(e) => setNewQty(e.target.value)}
              sx={{ width: 110 }}
            />
            <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={addCopies.isPending}>
              Add copies
            </Button>
          </Stack>
          {copyError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCopyError(null)}>
              {copyError}
            </Alert>
          )}
          {bookDetailQuery.data?.copies.length === 0 && <Alert severity="info">No copies yet.</Alert>}
          {!!bookDetailQuery.data?.copies.length && (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={darkTableHeadSx}>
                  <TableRow>
                    <TableCell>Accession no.</TableCell>
                    <TableCell>Barcode</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bookDetailQuery.data.copies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.accession_number}</TableCell>
                      <TableCell>{c.barcode ?? "—"}</TableCell>
                      <TableCell>
                        <CopyStatusChip status={c.status} />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {c.status !== "issued" && c.status !== "available" && (
                          <Button size="small" onClick={() => changeCopy.mutate({ id: c.id, status: "available" })}>
                            Mark available
                          </Button>
                        )}
                        {c.status !== "issued" && c.status !== "damaged" && (
                          <Button size="small" color="warning" onClick={() => changeCopy.mutate({ id: c.id, status: "damaged" })}>
                            Damaged
                          </Button>
                        )}
                        {c.status !== "issued" && c.status !== "lost" && (
                          <Button size="small" color="error" onClick={() => changeCopy.mutate({ id: c.id, status: "lost" })}>
                            Lost
                          </Button>
                        )}
                        {(c.status === "available" || c.status === "lost" || c.status === "damaged") && (
                          <IconButton size="small" onClick={() => removeCopy.mutate(c.id)} aria-label="Delete copy">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopiesBookId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
