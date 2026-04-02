"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc-client";

type MembersList = Awaited<ReturnType<typeof trpc.settings.members.list.query>>;

type MemberRow = MembersList["members"][number];
type PendingInviteRow = MembersList["pendingInvites"][number];

type Role = "admin" | "manager" | "analyst";

export type MembersTableRow =
  | { kind: "pending"; row: PendingInviteRow }
  | { kind: "member"; row: MemberRow };

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "analyst", label: "Analyst" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

function RoleText({ role }: { role: Role }) {
  return <span className="text-sm capitalize text-foreground">{role}</span>;
}

function formatJoinedAt(value: MemberRow["joinedAt"]): string {
  if (value == null) {
    return "—";
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

const shell = {
  wrap: "overflow-x-auto",
  headRow:
    "border-0 border-b border-border/50 [&_th]:bg-muted/50 dark:[&_th]:bg-muted/30 [&_th:first-child]:rounded-tl-lg [&_th:last-child]:rounded-tr-lg",
  bodyRow:
    "border-b border-border/40 last:border-b-0 hover:bg-muted/20 dark:hover:bg-muted/15",
};

function PendingRow({
  inv,
  canManageMembers,
  onCancelInvite,
}: {
  inv: PendingInviteRow;
  canManageMembers: boolean;
  onCancelInvite: (invitationId: string) => void;
}) {
  return (
    <TableRow className={shell.bodyRow}>
      <TableCell className="px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{inv.email}</div>
          <div className="truncate text-xs text-amber-700 dark:text-amber-400/90">
            Pending invitation
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3">
        <RoleText role={inv.role} />
      </TableCell>
      <TableCell className="px-4 py-3 text-sm text-muted-foreground">—</TableCell>
      <TableCell className="px-4 py-3">
        {canManageMembers ? (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Actions for invite ${inv.email}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onCancelInvite(inv.id)}
                >
                  Cancel invitation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function MemberRowView({
  m,
  canAct,
  onRoleChange,
  onRemove,
}: {
  m: MemberRow;
  canAct: boolean;
  onRoleChange: (userId: string, role: Role) => void;
  onRemove: (userId: string) => void;
}) {
  const otherRoles = ROLE_OPTIONS.filter((o) => o.value !== m.role);
  return (
    <TableRow className={shell.bodyRow}>
      <TableCell className="px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{m.fullName}</div>
          <div className="truncate text-xs text-muted-foreground">{m.email}</div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3">
        <RoleText role={m.role} />
      </TableCell>
      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
        {formatJoinedAt(m.joinedAt)}
      </TableCell>
      <TableCell className="px-4 py-3">
        {canAct ? (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Actions for ${m.fullName}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Change role
                </DropdownMenuLabel>
                {otherRoles.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => onRoleChange(m.userId, opt.value)}
                  >
                    Make {opt.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onRemove(m.userId)}
                >
                  Remove member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function MembersUnifiedTable({
  rows,
  canManageMembers,
  currentUserId,
  onRoleChange,
  onRemove,
  onCancelInvite,
  emptyLabel = "No members yet.",
  joinedSort = "newest",
  onToggleJoinedSort,
  showJoinedSortToggle = true,
}: {
  rows: MembersTableRow[];
  canManageMembers: boolean;
  currentUserId: string | undefined;
  onRoleChange: (userId: string, role: Role) => void;
  onRemove: (userId: string) => void;
  onCancelInvite: (invitationId: string) => void;
  emptyLabel?: string;
  joinedSort?: "newest" | "oldest";
  onToggleJoinedSort?: () => void;
  showJoinedSortToggle?: boolean;
}) {
  const hasRows = rows.length > 0;

  return (
    <div className={shell.wrap}>
      <Table className="overflow-hidden rounded-t-lg">
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className={shell.headRow}>
            <TableHead className="px-4">Member</TableHead>
            <TableHead className="px-4">Role</TableHead>
            <TableHead className="px-4 whitespace-nowrap">
              <div className="flex items-center gap-0.5">
                <span>Joined</span>
                {showJoinedSortToggle && onToggleJoinedSort ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={onToggleJoinedSort}
                    title={
                      joinedSort === "newest"
                        ? "Newest join first — click for oldest join first"
                        : "Oldest join first — click for newest join first"
                    }
                    aria-label={
                      joinedSort === "newest"
                        ? "Sort joined date: newest first. Switch to oldest first."
                        : "Sort joined date: oldest first. Switch to newest first."
                    }
                  >
                    {joinedSort === "newest" ? (
                      <ArrowDownWideNarrow className="size-4" />
                    ) : (
                      <ArrowUpNarrowWide className="size-4" />
                    )}
                  </Button>
                ) : null}
              </div>
            </TableHead>
            <TableHead className="w-12 px-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!hasRows ? (
            <TableRow className={shell.bodyRow}>
              <TableCell
                colSpan={4}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}

          {rows.map((item) => {
            if (item.kind === "pending") {
              return (
                <PendingRow
                  key={item.row.id}
                  inv={item.row}
                  canManageMembers={canManageMembers}
                  onCancelInvite={onCancelInvite}
                />
              );
            }
            const canAct =
              Boolean(canManageMembers && currentUserId) &&
              item.row.userId !== currentUserId;
            return (
              <MemberRowView
                key={item.row.membershipId}
                m={item.row}
                canAct={canAct}
                onRoleChange={onRoleChange}
                onRemove={onRemove}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
