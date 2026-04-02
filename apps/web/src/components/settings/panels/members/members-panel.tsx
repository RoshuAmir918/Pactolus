"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMe } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc-client";
import { authUserAtom } from "@/stores/auth";

import { MembersInviteDialog } from "./members-invite-dialog";
import { MembersUnifiedTable, type MembersTableRow } from "./members-tables";

type MembersList = Awaited<ReturnType<typeof trpc.settings.members.list.query>>;

type Role = "admin" | "manager" | "analyst";

const PAGE_SIZE = 10;

const ROLE_RANK: Record<Role, number> = {
  admin: 0,
  manager: 1,
  analyst: 2,
};

function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatJoinedForCsv(value: MembersList["members"][number]["joinedAt"]): string {
  if (value == null) {
    return "";
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function buildMembersCsvFromRows(rows: MembersTableRow[]): string {
  const lines: string[] = ["Member,Email,Role,Status,Joined"];
  for (const item of rows) {
    if (item.kind === "pending") {
      const inv = item.row;
      lines.push(
        [
          csvEscapeCell(""),
          csvEscapeCell(inv.email),
          csvEscapeCell(inv.role),
          csvEscapeCell("Pending"),
          csvEscapeCell(""),
        ].join(","),
      );
    } else {
      const m = item.row;
      lines.push(
        [
          csvEscapeCell(m.fullName),
          csvEscapeCell(m.email),
          csvEscapeCell(m.role),
          csvEscapeCell("Active"),
          csvEscapeCell(formatJoinedForCsv(m.joinedAt)),
        ].join(","),
      );
    }
  }
  return lines.join("\r\n");
}

function triggerCsvDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function memberJoinedTs(m: MembersList["members"][number]): number | null {
  if (m.joinedAt == null) {
    return null;
  }
  const d = m.joinedAt instanceof Date ? m.joinedAt : new Date(m.joinedAt);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.getTime();
}

function sortMembersTableRows(
  rows: MembersTableRow[],
  joinedSort: "newest" | "oldest",
): MembersTableRow[] {
  return [...rows].sort((a, b) => {
    const rank = ROLE_RANK[a.row.role] - ROLE_RANK[b.row.role];
    if (rank !== 0) {
      return rank;
    }

    const pendingA = a.kind === "pending";
    const pendingB = b.kind === "pending";

    if (!pendingA && !pendingB) {
      const ta = memberJoinedTs(a.row);
      const tb = memberJoinedTs(b.row);
      if (ta == null && tb == null) {
        return a.row.email.localeCompare(b.row.email);
      }
      if (ta == null) {
        return 1;
      }
      if (tb == null) {
        return -1;
      }
      if (joinedSort === "newest") {
        if (ta > tb) {
          return -1;
        }
        if (ta < tb) {
          return 1;
        }
        return a.row.email.localeCompare(b.row.email);
      }
      if (ta < tb) {
        return -1;
      }
      if (ta > tb) {
        return 1;
      }
      return a.row.email.localeCompare(b.row.email);
    }

    if (!pendingA && pendingB) {
      return -1;
    }
    if (pendingA && !pendingB) {
      return 1;
    }

    return a.row.email.localeCompare(b.row.email);
  });
}

function MembersPageIntro() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Members
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Invite people by email (new members join as analysts). Admins can change roles, remove
        members, or cancel pending invitations. Managers and analysts can view this list.
      </p>
    </div>
  );
}

function MembersControlsSkeleton({ showInvite }: { showInvite: boolean }) {
  return (
    <div className="flex w-full justify-end gap-2" aria-hidden>
      <Skeleton className="size-9 shrink-0 rounded-md" />
      {showInvite ? <Skeleton className="h-9 w-[4.5rem] shrink-0 rounded-md" /> : null}
    </div>
  );
}

function MembersTableSkeleton() {
  const headRow =
    "border-0 border-b border-border/50 [&_th]:bg-muted/50 dark:[&_th]:bg-muted/30 [&_th:first-child]:rounded-tl-lg [&_th:last-child]:rounded-tr-lg";
  return (
    <div className="overflow-x-auto" aria-hidden>
      <Table className="overflow-hidden rounded-t-lg">
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className={headRow}>
            <TableHead className="px-4">Member</TableHead>
            <TableHead className="px-4">Role</TableHead>
            <TableHead className="px-4">Joined</TableHead>
            <TableHead className="w-12 px-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {[0, 1, 2].map((i) => (
            <TableRow key={i} className="border-b border-border/40 last:border-b-0">
              <TableCell className="px-4 py-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="px-4 py-3">
                <Skeleton className="size-8 rounded-md" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function MembersPanel() {
  const authUser = useAtomValue(authUserAtom);
  const setAuthUser = useSetAtom(authUserAtom);
  const [data, setData] = useState<MembersList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [joinedSort, setJoinedSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteBulkBusy, setInviteBulkBusy] = useState(false);
  const [inviteDialogError, setInviteDialogError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const next = await trpc.settings.members.list.query();
      setData(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getMe()
      .then(setAuthUser)
      .catch(() => {});
  }, [setAuthUser]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [joinedSort]);

  const canManageMembers = authUser?.role === "admin";

  const { sortedTableRows, showJoinedSortToggle } = useMemo(() => {
    if (!data) {
      return { sortedTableRows: [] as MembersTableRow[], showJoinedSortToggle: false };
    }
    const base: MembersTableRow[] = [
      ...data.pendingInvites.map((row) => ({ kind: "pending" as const, row })),
      ...data.members.map((row) => ({ kind: "member" as const, row })),
    ];
    return {
      sortedTableRows: sortMembersTableRows(base, joinedSort),
      showJoinedSortToggle: data.members.length > 0,
    };
  }, [data, joinedSort]);

  const totalFiltered = sortedTableRows.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedRows = sortedTableRows.slice(pageStart, pageStart + PAGE_SIZE);

  const rangeEnd = totalFiltered === 0 ? 0 : Math.min(pageStart + PAGE_SIZE, totalFiltered);
  const rangeStart = totalFiltered === 0 ? 0 : pageStart + 1;

  const emptyLabel = "No members yet.";

  const onDownloadCsv = useCallback(() => {
    const csv = buildMembersCsvFromRows(sortedTableRows);
    triggerCsvDownload("members.csv", csv);
  }, [sortedTableRows]);

  const onRemove = useCallback(
    async (targetUserId: string) => {
      if (!window.confirm("Remove this member from the organization?")) return;
      try {
        await trpc.settings.members.remove.mutate({ targetUserId });
        await reload();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Remove failed");
      }
    },
    [reload],
  );

  const onRoleChange = useCallback(
    async (targetUserId: string, role: Role) => {
      try {
        await trpc.settings.members.updateRole.mutate({ targetUserId, role });
        await reload();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Update failed");
      }
    },
    [reload],
  );

  const onCancelInvite = useCallback(
    async (invitationId: string) => {
      try {
        await trpc.settings.members.cancelInvite.mutate({ invitationId });
        await reload();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Could not cancel invitation");
      }
    },
    [reload],
  );

  const onBulkInvite = useCallback(
    async (emails: string[]) => {
      setInviteDialogError(null);
      if (emails.length === 0) {
        setInviteDialogError("Enter at least one valid email address.");
        return;
      }
      setInviteBulkBusy(true);
      const failures: string[] = [];
      for (const email of emails) {
        try {
          await trpc.settings.members.invite.mutate({ inviteEmail: email });
        } catch (e) {
          const err = e as { message?: string };
          const msg = err.message ? String(err.message) : "Invite failed";
          failures.push(`${email}: ${msg}`);
        }
      }
      setInviteBulkBusy(false);
      const ok = emails.length - failures.length;
      if (ok === 0) {
        setInviteDialogError(failures.join("\n"));
        return;
      }
      await reload();
      if (failures.length > 0) {
        window.alert(`Some invites failed:\n${failures.join("\n")}`);
      }
      setInviteOpen(false);
    },
    [reload],
  );

  if (loading) {
    const showToolbarInvite = !authUser || authUser.role === "admin";

    return (
      <div className="space-y-10">
        <MembersPageIntro />
        {!showToolbarInvite ? (
          <p className="text-sm text-muted-foreground">
            You can view members. Ask an admin to invite people or change roles.
          </p>
        ) : null}
        <div className="space-y-4">
          <MembersControlsSkeleton showInvite={showToolbarInvite} />
          <MembersTableSkeleton />
          <div className="flex items-center justify-between py-2">
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-2">
              <Skeleton className="size-9 rounded-md" />
              <Skeleton className="size-9 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <MembersPageIntro />

      {!canManageMembers ? (
        <p className="text-sm text-muted-foreground">
          You can view members. Ask an admin to invite people or change roles.
        </p>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onDownloadCsv}
              aria-label="Download members as CSV"
            >
              <Download className="size-4" />
            </Button>
            {canManageMembers ? (
              <Button type="button" onClick={() => setInviteOpen(true)}>
                Invite
              </Button>
            ) : null}
          </div>

          <div>
            <MembersUnifiedTable
              rows={pagedRows}
              canManageMembers={canManageMembers}
              currentUserId={authUser?.userId}
              onRoleChange={onRoleChange}
              onRemove={onRemove}
              onCancelInvite={onCancelInvite}
              emptyLabel={emptyLabel}
              joinedSort={joinedSort}
              onToggleJoinedSort={() =>
                setJoinedSort((s) => (s === "newest" ? "oldest" : "newest"))
              }
              showJoinedSortToggle={showJoinedSortToggle}
            />
            <div className="flex flex-col gap-3 border-t border-border/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {totalFiltered === 0
                  ? "0 people"
                  : `Showing ${rangeStart}–${rangeEnd} of ${totalFiltered}`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
                  Page {safePage} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {canManageMembers ? (
            <MembersInviteDialog
              open={inviteOpen}
              onOpenChange={(open) => {
                setInviteOpen(open);
                if (!open) {
                  setInviteDialogError(null);
                }
              }}
              busy={inviteBulkBusy}
              errorMessage={inviteDialogError}
              onSend={onBulkInvite}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
