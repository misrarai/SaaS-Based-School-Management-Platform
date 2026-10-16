import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import BusinessIcon from "@mui/icons-material/Business";
import SaveIcon from "@mui/icons-material/Save";
import { AppShell } from "../../../components/AppShell";
import { adminNavItems } from "../adminNav";
import { apiClient } from "../../../api/client";

interface TenantOut {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  is_active: boolean;
  plan: string;
  address?: string;
  phone?: string;
  website?: string;
  bank_name?: string;
  bank_account_title?: string;
  bank_account_number?: string;
  bank_iban?: string;
  bank_branch?: string;
}

async function getMyTenant(): Promise<TenantOut> {
  const res = await apiClient.get("/tenants/me");
  return res.data;
}

async function updateMyTenant(payload: Partial<TenantOut>): Promise<TenantOut> {
  const res = await apiClient.patch("/tenants/me", payload);
  return res.data;
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 2,
          bgcolor: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" fontWeight={700}>
        {title}
      </Typography>
    </Stack>
  );
}

export function SchoolSettingsPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>({
    open: false,
    msg: "",
    severity: "success",
  });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant-me"],
    queryFn: getMyTenant,
  });

  const [form, setForm] = useState<Partial<TenantOut>>({});

  // Merge loaded data into form only once
  const merged = { ...tenant, ...form };

  const mutation = useMutation({
    mutationFn: updateMyTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-me"] });
      setToast({ open: true, msg: "Settings saved successfully.", severity: "success" });
      setForm({});
    },
    onError: () => {
      setToast({ open: true, msg: "Failed to save settings.", severity: "error" });
    },
  });

  const field = (key: keyof TenantOut) => ({
    value: (merged[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const handleSave = () => {
    const payload: Partial<TenantOut> = {};
    const keys: (keyof TenantOut)[] = [
      "name", "contact_email", "address", "phone", "website",
      "bank_name", "bank_account_title", "bank_account_number", "bank_iban", "bank_branch",
    ];
    for (const k of keys) {
      if (form[k] !== undefined) payload[k] = form[k] as string;
    }
    if (Object.keys(payload).length === 0) {
      setToast({ open: true, msg: "No changes to save.", severity: "success" });
      return;
    }
    mutation.mutate(payload);
  };

  return (
    <AppShell title="School Settings" navItems={adminNavItems}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>School Settings</Typography>
          <Typography color="text.secondary" variant="body2">
            Manage school profile, contact info, and bank account for fee challans
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={mutation.isPending || isLoading}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Save Changes
        </Button>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* School Profile */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <SectionHeader icon={<BusinessIcon fontSize="small" />} title="School Profile" />
                <Stack spacing={2.5}>
                  <TextField label="School Name" fullWidth {...field("name")} />
                  <TextField label="Contact Email" fullWidth type="email" {...field("contact_email")} />
                  <TextField label="Phone Number" fullWidth placeholder="+92 300 0000000" {...field("phone")} />
                  <TextField label="Website" fullWidth placeholder="https://yourschool.edu.pk" {...field("website")} />
                  <TextField
                    label="Address"
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Street, City, Province"
                    {...field("address")}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Bank Details */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <SectionHeader icon={<AccountBalanceIcon fontSize="small" />} title="Bank Account Details" />
                <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
                  These details are printed on every fee challan so parents and students know exactly where to deposit the fee — via JazzCash, EasyPaisa, or direct bank transfer.
                </Alert>
                <Stack spacing={2.5}>
                  <TextField
                    label="Bank Name"
                    fullWidth
                    placeholder="e.g. HBL, MCB, UBL, Meezan Bank"
                    {...field("bank_name")}
                  />
                  <TextField
                    label="Account Title"
                    fullWidth
                    placeholder="e.g. Al-Noor School Fund"
                    {...field("bank_account_title")}
                  />
                  <TextField
                    label="Account Number"
                    fullWidth
                    placeholder="e.g. 1234567890123"
                    {...field("bank_account_number")}
                  />
                  <TextField
                    label="IBAN"
                    fullWidth
                    placeholder="e.g. PK36SCBL0000001123456702"
                    {...field("bank_iban")}
                  />
                  <TextField
                    label="Branch Name / Code"
                    fullWidth
                    placeholder="e.g. Blue Area Islamabad — 0083"
                    {...field("bank_branch")}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Info box */}
          <Grid item xs={12}>
            <Divider />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Bank details are embedded in every generated fee voucher (Bank Copy, School Copy, Student Copy) under a
              highlighted "PAY INTO BANK ACCOUNT" section. Students and parents can use JazzCash, EasyPaisa, or any
              banking app to transfer fees directly to this account.
            </Typography>
          </Grid>
        </Grid>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ borderRadius: 2 }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </AppShell>
  );
}
