import { useQuery } from "@tanstack/react-query";
import { Alert, Paper, Stack, Typography } from "@mui/material";
import { AppShell } from "../../../components/AppShell";
import { parentNavItems } from "../parentNav";
import { getChildrenLibrary } from "../../../api/library";
import {
  IssuesTable,
  ReservationsTable,
  StatTile,
  formatMoney,
  libraryParentNav,
  withLibraryNav,
} from "../../libraryShared";

const navItems = withLibraryNav(parentNavItems, libraryParentNav);

export function ParentLibraryPage() {
  const query = useQuery({ queryKey: ["library", "children"], queryFn: getChildrenLibrary });

  return (
    <AppShell title="Library" navItems={navItems}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Library
      </Typography>
      {query.isLoading && <Typography>Loading…</Typography>}
      {query.data?.length === 0 && <Alert severity="info">No children are linked to your account.</Alert>}
      <Stack spacing={3}>
        {(query.data ?? []).map((child) => {
          const current = child.issues.filter((i) => i.status === "issued");
          const past = child.issues.filter((i) => i.status !== "issued");
          const activeRes = child.reservations.filter((r) => r.status === "pending" || r.status === "ready");
          return (
            <Paper key={child.student_id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                {child.student_name}
              </Typography>
              {!child.member ? (
                <Alert severity="info">{child.student_name} is not yet registered with the library.</Alert>
              ) : (
                <>
                  <Stack direction="row" sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}>
                    <StatTile label="Card number" value={child.member.card_number} />
                    <StatTile label="Books issued" value={`${current.length} / ${child.max_books}`} />
                    <StatTile
                      label="Overdue"
                      value={current.filter((i) => i.is_overdue).length}
                      tone={current.some((i) => i.is_overdue) ? "error.main" : undefined}
                    />
                    <StatTile
                      label="Outstanding fine"
                      value={formatMoney(child.outstanding_fine)}
                      tone={child.outstanding_fine > 0 ? "error.main" : undefined}
                    />
                  </Stack>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Currently issued
                  </Typography>
                  <IssuesTable issues={current} showMember={false} emptyText="No books issued right now." />
                  {activeRes.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
                        Reservations
                      </Typography>
                      <ReservationsTable reservations={activeRes} showMember={false} />
                    </>
                  )}
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
                    History & fines
                  </Typography>
                  <IssuesTable issues={past} showMember={false} emptyText="No past borrowing." />
                </>
              )}
            </Paper>
          );
        })}
      </Stack>
    </AppShell>
  );
}
