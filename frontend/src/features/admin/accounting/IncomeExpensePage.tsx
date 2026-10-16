import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { darkTableHeadSx } from "../../../components/tableStyles";
import { createQuickEntry, listAccounts, listQuickEntries, openVoucherPdf } from "../../../api/accounting";
import { AccountSelect, apiErrorMessage, DateField, fmtMoney, monthStartIso, PageHeader, todayIso } from "./common";

type EntryType = "expense" | "income";

export function IncomeExpensePage() {
  const queryClient = useQueryClient();
  const [entryType, setEntryType] = useState<EntryType>("expense");
  const [headId, setHeadId] = useState("");
  const [cashBankId, setCashBankId] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [payee, setPayee] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());

  const accountsQuery = useQuery({ queryKey: ["acc-accounts"], queryFn: () => listAccounts() });
  const entriesQuery = useQuery({
    queryKey: ["acc-quick", from, to],
    queryFn: () => listQuickEntries({ date_from: from || undefined, date_to: to || undefined }),
  });
  const accounts = accountsQuery.data ?? [];

  const headFilter =
    entryType === "expense"
      ? (a: { account_type: string; subtype: string | null }) => a.account_type === "expense" || (a.account_type === "asset" && !a.subtype) || a.account_type === "liability"
      : (a: { account_type: string }) => a.account_type === "income" || a.account_type === "liability" || a.account_type === "equity";

  const save = useMutation({
    mutationFn: () =>
      createQuickEntry({
        entry_type: entryType,
        head_account_id: headId,
        cash_bank_account_id: cashBankId,
        amount: Number(amount),
        entry_date: entryDate,
        payee: payee || undefined,
        description: description || undefined,
        attachment_url: attachment || undefined,
        reference: reference || undefined,
      }),
    onSuccess: (v) => {
      setMessage({ severity: "success", text: `Recorded as ${v.voucher_number}.` });
      setAmount("");
      setPayee("");
      setDescription("");
      setAttachment("");
      setReference("");
      queryClient.invalidateQueries({ queryKey: ["acc-quick"] });
      queryClient.invalidateQueries({ queryKey: ["acc-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["acc-accounts"] });
    },
    onError: (e) => setMessage({ severity: "error", text: apiErrorMessage(e, "Could not save entry.") }),
  });

  const entries = entriesQuery.data ?? [];
  const isIncome = (vt: string) => vt === "CRV" || vt === "BRV";
  const totalIncome = entries.filter((v) => isIncome(v.voucher_type)).reduce((s, v) => s + v.total_debit, 0);
  const totalExpense = entries.filter((v) => !isIncome(v.voucher_type)).reduce((s, v) => s + v.total_debit, 0);

  return (
    <AppShell title="Income & Expenses" navItems={adminNavItems}>
      <PageHeader title="Income & Expenses" />
      {accounts.length === 0 && !accountsQuery.isLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Set up your chart of accounts first (Accounts → Chart of Accounts → Load default chart).
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            save.mutate();
          }}
        >
          <Stack spacing={2}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={entryType}
              onChange={(_, v: EntryType | null) => {
                if (v) {
                  setEntryType(v);
                  setHeadId("");
                }
              }}
            >
              <ToggleButton value="expense">Expense</ToggleButton>
              <ToggleButton value="income">Income</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
              <AccountSelect
                accounts={accounts}
                value={headId}
                onChange={setHeadId}
                label={entryType === "expense" ? "Expense head" : "Income head"}
                filter={headFilter}
                required
                width={280}
              />
              <AccountSelect
                accounts={accounts}
                value={cashBankId}
                onChange={setCashBankId}
                label={entryType === "expense" ? "Paid from" : "Received in"}
                filter={(a) => a.subtype === "cash" || a.subtype === "bank"}
                required
                width={240}
              />
              <TextField size="small" label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required sx={{ width: 160 }} />
              <DateField label="Date" value={entryDate} onChange={setEntryDate} />
            </Stack>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
              <TextField size="small" label={entryType === "expense" ? "Payee" : "Received from"} value={payee} onChange={(e) => setPayee(e.target.value)} sx={{ width: 240 }} />
              <TextField size="small" label="Reference / bill no." value={reference} onChange={(e) => setReference(e.target.value)} sx={{ width: 200 }} />
              <TextField size="small" label="Attachment URL" value={attachment} onChange={(e) => setAttachment(e.target.value)} sx={{ flex: 1, minWidth: 240 }} />
            </Stack>
            <TextField size="small" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} />
            {message && <Alert severity={message.severity}>{message.text}</Alert>}
            <Box>
              <Button type="submit" variant="contained" disabled={save.isPending || !headId || !cashBankId || !amount}>
                Record {entryType}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h6">Recent entries</Typography>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
        <Chip color="success" label={`Income: ${fmtMoney(totalIncome)}`} />
        <Chip color="error" label={`Expense: ${fmtMoney(totalExpense)}`} />
      </Stack>
      {entries.length === 0 ? (
        <Alert severity="info">No income or expense entries in this range.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={darkTableHeadSx}>
              <TableRow>
                <TableCell>Voucher</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Head</TableCell>
                <TableCell>Payee</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((v) => {
                const income = isIncome(v.voucher_type);
                const head = v.lines.find((l) => (income ? l.credit > 0 : l.debit > 0));
                return (
                  <TableRow key={v.id} hover>
                    <TableCell sx={{ fontFamily: "monospace" }}>{v.voucher_number}</TableCell>
                    <TableCell>{v.voucher_date}</TableCell>
                    <TableCell>
                      <Chip size="small" label={income ? "income" : "expense"} color={income ? "success" : "error"} variant="outlined" />
                    </TableCell>
                    <TableCell>{head ? head.account_name : "—"}</TableCell>
                    <TableCell>{v.payee ?? "—"}</TableCell>
                    <TableCell>{v.narration ?? ""}</TableCell>
                    <TableCell align="right">{fmtMoney(v.total_debit)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {v.attachment_url && (
                        <Button size="small" href={v.attachment_url} target="_blank" rel="noreferrer">
                          Attachment
                        </Button>
                      )}
                      <Button size="small" onClick={() => openVoucherPdf(v.id)}>
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AppShell>
  );
}
