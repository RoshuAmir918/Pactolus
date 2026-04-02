"use client";

import { useEffect, useMemo, useState } from "react";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Settings,
  Sun,
  Moon,
  LogOut,
  GitBranch,
  FileText,
  Play,
  Layers,
  ChevronsUpDown,
  Check,
  X,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { demoOrgsAtom, type DemoOrg, reloadWorkspaceAtom } from "@/stores/workspace";
import { authUserAtom } from "@/stores/auth";
import {
  activeViewAtom,
  activeClientIdAtom,
  activeSnapshotIdAtom,
  activeRunIdAtom,
  leftPaneModeAtom,
  expandedSnapshotIdsAtom,
} from "@/stores/workspace-ui";
import { useTheme } from "@/providers/theme-provider";
import { trpc } from "@/lib/trpc-client";
import { SourceDocumentsSection } from "@/components/workspace/sidebar/source-documents-section";

// ── persistence ──────────────────────────────────────────────────────────────

const VIEWS_KEY = "pactolus_workspace_views";
const RECENT_KEY = "pactolus_recent_orgs";

type PinnedView = {
  id: string;
  orgId: string;
};

function loadPinnedViews(orgs: DemoOrg[]): PinnedView[] {
  const first = orgs[0];
  if (!first) return [];
  if (typeof window === "undefined") return [{ id: "view-1", orgId: first.id }];
  try {
    const raw = window.localStorage.getItem(VIEWS_KEY);
    if (!raw) return [{ id: "view-1", orgId: first.id }];
    const parsed = JSON.parse(raw) as PinnedView[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: "view-1", orgId: first.id }];
  } catch {
    return [{ id: "view-1", orgId: first.id }];
  }
}

function savePinnedViews(views: PinnedView[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); } catch { /* ignore */ }
}

function loadRecentOrgs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveRecentOrgs(ids: string[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

// ── sidebar-local state atoms (module-level so they survive re-renders) ──────

type SidebarView = "home" | "snapshot";
const sidebarViewAtom = atom<SidebarView>("home");
const sidebarSnapshotClientAtom = atom<DemoOrg | null>(null);
const sidebarSnapshotIdAtom = atom<string | null>(null);

type LiveRun = {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
  branchCount: number;
};

// ── component ────────────────────────────────────────────────────────────────

export function LeftSidebar() {
  const orgs = useAtomValue(demoOrgsAtom);
  const user = useAtomValue(authUserAtom);
  const reloadWorkspace = useSetAtom(reloadWorkspaceAtom);
  const { theme, setTheme } = useTheme();

  const [sidebarView, setSidebarView] = useAtom(sidebarViewAtom);
  const [snapshotClient, setSnapshotClient] = useAtom(sidebarSnapshotClientAtom);
  const [snapshotId, setSnapshotId] = useAtom(sidebarSnapshotIdAtom);
  const [expandedRuns, setExpandedRuns] = useAtom(expandedSnapshotIdsAtom);

  const setActiveView = useSetAtom(activeViewAtom);
  const setActiveClientId = useSetAtom(activeClientIdAtom);
  const setActiveSnapshotId = useSetAtom(activeSnapshotIdAtom);
  const setActiveRunId = useSetAtom(activeRunIdAtom);
  const setLeftPaneMode = useSetAtom(leftPaneModeAtom);

  const [pinnedViews, setPinnedViews] = useState<PinnedView[]>([]);
  const [recentOrgIds, setRecentOrgIds] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Live runs for the currently-open snapshot
  const [runs, setRuns] = useState<LiveRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Branch counts per run — fetched lazily
  const [branchCounts, setBranchCounts] = useState<Record<string, number>>({});

  // New snapshot inline form state
  const [newSnapOrgId, setNewSnapOrgId] = useState<string | null>(null);
  const [newSnapName, setNewSnapName] = useState("");
  const [newSnapSubmitting, setNewSnapSubmitting] = useState(false);

  useEffect(() => {
    setPinnedViews(loadPinnedViews(orgs));
    setRecentOrgIds(loadRecentOrgs());
    setHydrated(true);
  }, [orgs]);

  useEffect(() => {
    if (hydrated) savePinnedViews(pinnedViews);
  }, [pinnedViews, hydrated]);

  // Fetch runs whenever snapshot changes
  useEffect(() => {
    if (sidebarView !== "snapshot" || !snapshotId) {
      setRuns([]);
      return;
    }
    setRunsLoading(true);
    setRuns([]);
    setBranchCounts({});
    trpc.operations.getRunsBySnapshot
      .query({ snapshotId, limit: 25 })
      .then(async (result) => {
        setRuns(result.runs.map((r) => ({ id: r.id, name: r.name, status: r.status, branchCount: 0 })));
        // Fetch branch counts in parallel
        const counts = await Promise.all(
          result.runs.map((r) =>
            trpc.operations.getRunBranches
              .query({ runId: r.id })
              .then((b) => ({ runId: r.id, count: b.branches.length }))
              .catch(() => ({ runId: r.id, count: 0 })),
          ),
        );
        setBranchCounts(Object.fromEntries(counts.map((c) => [c.runId, c.count])));
      })
      .catch(() => setRuns([]))
      .finally(() => setRunsLoading(false));
  }, [sidebarView, snapshotId]);

  // ── helpers ────────────────────────────────────────────────────────────────

  function mostRecentSnapshot(org: DemoOrg) {
    return org.snapshots[0] ?? null;
  }

  function addClient(orgId: string) {
    const org = orgs.find((o) => o.id === orgId);
    if (!org || pinnedViews.some((v) => v.orgId === orgId)) return;
    const newView: PinnedView = { id: `view-${Date.now()}`, orgId };
    setPinnedViews((prev) => [...prev, newView]);
    const next = [orgId, ...recentOrgIds.filter((id) => id !== orgId)].slice(0, 8);
    setRecentOrgIds(next);
    saveRecentOrgs(next);
    setAddOpen(false);
    setAddSearch("");
  }

  function removeClient(orgId: string) {
    setPinnedViews((prev) => prev.filter((v) => v.orgId !== orgId));
  }

  async function submitNewSnapshot(orgId: string) {
    const label = newSnapName.trim();
    if (!label) return;
    setNewSnapSubmitting(true);
    try {
      await trpc.ingestion.createSnapshot.mutate({ clientId: orgId, label });
      setNewSnapOrgId(null);
      setNewSnapName("");
      await reloadWorkspace();
    } catch {
      // leave form open on error
    } finally {
      setNewSnapSubmitting(false);
    }
  }

  function openSnapshot(org: DemoOrg, snapId: string) {
    setSnapshotClient(org);
    setSnapshotId(snapId);
    setSidebarView("snapshot");
    setLeftPaneMode("snapshot");
    setActiveClientId(org.id);
    setActiveSnapshotId(snapId);
    setActiveView({ type: "snapshot", clientId: org.id, snapshotId: snapId });
  }

  function selectRun(org: DemoOrg, snapId: string, runId: string) {
    setActiveClientId(org.id);
    setActiveSnapshotId(snapId);
    setActiveRunId(runId);
    setActiveView({ type: "run", clientId: org.id, snapshotId: snapId, runId });
  }

  function toggleRunExpand(runId: string) {
    setExpandedRuns((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  const activeView = useAtomValue(activeViewAtom);
  function isRunActive(runId: string) {
    return (activeView.type === "run" || activeView.type === "node") &&
      (activeView as { runId: string }).runId === runId;
  }

  // Orgs sorted: recently used first, then alphabetical, excluding already-pinned
  const addableOrgs = useMemo(() => {
    const pinned = new Set(pinnedViews.map((v) => v.orgId));
    const q = addSearch.trim().toLowerCase();
    const filtered = orgs.filter((o) => !pinned.has(o.id) && (!q || o.name.toLowerCase().includes(q)));
    const map = new Map(filtered.map((o) => [o.id, o]));
    const recent = recentOrgIds.map((id) => map.get(id)).filter(Boolean) as DemoOrg[];
    const rest = filtered.filter((o) => !recentOrgIds.includes(o.id)).sort((a, b) => a.name.localeCompare(b.name));
    return [...recent, ...rest];
  }, [orgs, pinnedViews, recentOrgIds, addSearch]);

  // ── skeleton while hydrating ───────────────────────────────────────────────

  if (!hydrated) {
    return (
      <Sidebar>
        <SidebarHeader className="border-b px-3 py-3">
          <div className="h-8 rounded-md bg-muted animate-pulse" />
        </SidebarHeader>
        <SidebarContent>
          <div className="space-y-2 p-3">
            <div className="h-14 rounded-lg bg-muted/60 animate-pulse" />
            <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  // ── snapshot detail view ───────────────────────────────────────────────────

  if (sidebarView === "snapshot" && snapshotClient && snapshotId) {
    const snap = snapshotClient.snapshots.find((s) => s.id === snapshotId);

    return (
      <Sidebar>
        {/* Header: back + snapshot name */}
        <SidebarHeader className="border-b px-2 py-2">
          <button
            onClick={() => { setSidebarView("home"); setLeftPaneMode("clients"); }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors w-full"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            All clients
          </button>
          <div className="px-2 pt-1 pb-0.5">
            <p className="text-[10px] text-muted-foreground font-medium">{snapshotClient.name}</p>
            <p className="text-sm font-semibold text-sidebar-foreground">{snap?.name ?? snapshotId}</p>
          </div>
        </SidebarHeader>

        <SidebarContent className="overflow-y-auto">
          {/* Source documents */}
          <SourceDocumentsSection snapshotId={snapshotId} />

          <SidebarSeparator />

          {/* Runs */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider px-3">
              Runs
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {runsLoading && (
                  <div className="space-y-1.5 px-3 py-2">
                    <div className="h-7 rounded bg-muted/60 animate-pulse" />
                    <div className="h-7 rounded bg-muted/40 animate-pulse" />
                  </div>
                )}
                {!runsLoading && runs.length === 0 && (
                  <p className="px-4 py-2 text-xs text-muted-foreground">No runs yet.</p>
                )}
                {runs.map((run) => {
                  const bCount = branchCounts[run.id] ?? 0;
                  return (
                    <SidebarMenuItem key={run.id}>
                      <SidebarMenuButton
                        isActive={isRunActive(run.id)}
                        onClick={() => selectRun(snapshotClient, snapshotId, run.id)}
                        className="gap-2"
                      >
                        <Play className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 truncate">{run.name}</span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full border shrink-0",
                          run.status === "running"
                            ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30"
                            : "text-muted-foreground border-border"
                        )}>
                          {run.status}
                        </span>
                      </SidebarMenuButton>

                      {bCount > 0 && (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton
                              onClick={() => toggleRunExpand(run.id)}
                              className="text-muted-foreground gap-1.5"
                            >
                              <GitBranch className="w-3 h-3" />
                              <span>{bCount} branch{bCount !== 1 ? "es" : ""}</span>
                              {expandedRuns.has(run.id) ? (
                                <ChevronDown className="w-3 h-3 ml-auto" />
                              ) : (
                                <ChevronRight className="w-3 h-3 ml-auto" />
                              )}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

        </SidebarContent>

        <SidebarFooter className="border-t">
          <UserFooter user={user} theme={theme} setTheme={setTheme} />
        </SidebarFooter>
      </Sidebar>
    );
  }

  // ── home view (pinned clients) ─────────────────────────────────────────────

  return (
    <Sidebar>
      {/* Workspace header */}
      <SidebarHeader className="border-b px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-xs font-bold">P</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">Pactolus</p>
            <p className="text-[10px] text-muted-foreground">Workspace</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-sidebar-accent text-muted-foreground">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="text-xs">
                <Settings className="w-3.5 h-3.5 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider flex items-center justify-between pr-2">
            <span>Active clients</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pinnedViews.map((view) => {
                const org = orgs.find((o) => o.id === view.orgId);
                if (!org) return null;
                const latestSnap = mostRecentSnapshot(org);

                return (
                  <SidebarMenuItem key={view.id}>
                    {/* Client card — click to open snapshot */}
                    <div className="mx-1 mb-1 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors group">
                      <button
                        onClick={() => latestSnap && openSnapshot(org, latestSnap.id)}
                        className="w-full text-left px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-primary">{org.name[0]}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground truncate flex-1">{org.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {latestSnap ? (
                          <div className="flex items-center gap-1.5 pl-8">
                            <Layers className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{latestSnap.name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                              {org.snapshots.length} snap{org.snapshots.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground pl-8">No snapshots</p>
                        )}
                      </button>

                      {/* Footer row */}
                      <div className="border-t border-border/50 px-3 py-1.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {org.snapshots.length > 1 ? `+${org.snapshots.length - 1} older` : "Latest snapshot"}
                        </span>
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewSnapOrgId(org.id);
                              setNewSnapName("");
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            New snapshot
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeClient(org.id); }}
                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Inline new snapshot form */}
                      {newSnapOrgId === org.id && (
                        <div
                          className="border-t border-border/50 px-3 py-2 flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            type="text"
                            value={newSnapName}
                            onChange={(e) => setNewSnapName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitNewSnapshot(org.id);
                              if (e.key === "Escape") { setNewSnapOrgId(null); setNewSnapName(""); }
                            }}
                            placeholder="Snapshot name…"
                            className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring min-w-0"
                            disabled={newSnapSubmitting}
                          />
                          <button
                            onClick={() => submitNewSnapshot(org.id)}
                            disabled={!newSnapName.trim() || newSnapSubmitting}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-40 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setNewSnapOrgId(null); setNewSnapName(""); }}
                            className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </SidebarMenuItem>
                );
              })}

              {pinnedViews.length === 0 && (
                <div className="mx-1 rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Add clients to your workspace to get started
                  </p>
                </div>
              )}

              {/* Add client button */}
              <SidebarMenuItem>
                <Popover open={addOpen} onOpenChange={setAddOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs mx-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add client
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" sideOffset={8} className="w-64 p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search clients..."
                        value={addSearch}
                        onValueChange={setAddSearch}
                      />
                      <CommandList className="max-h-64">
                        <CommandEmpty>No clients found.</CommandEmpty>
                        <CommandGroup heading="Add to workspace">
                          {addableOrgs.map((org) => (
                            <CommandItem
                              key={org.id}
                              value={org.name}
                              onSelect={() => addClient(org.id)}
                              className="cursor-pointer"
                            >
                              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0 mr-2">
                                <span className="text-[10px] font-bold text-primary">{org.name[0]}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{org.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {org.snapshots.length} snapshot{org.snapshots.length !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                          {addableOrgs.length === 0 && !addSearch && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">
                              All clients already added.
                            </p>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <UserFooter user={user} theme={theme} setTheme={setTheme} />
      </SidebarFooter>
    </Sidebar>
  );
}

// ── shared footer ─────────────────────────────────────────────────────────────

function UserFooter({
  user,
  theme,
  setTheme,
}: {
  user: { userId: string; orgId: string; role: string } | null;
  theme: string;
  setTheme: (t: "light" | "dark") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-sidebar-accent rounded-md transition-colors">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">
              {user?.userId?.slice(0, 2).toUpperCase() ?? "AN"}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user ? "Analyst" : "Guest"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {user?.orgId ? user.orgId.slice(0, 12) + "…" : "Not signed in"}
            </p>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuItem
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-xs cursor-pointer"
        >
          {theme === "dark" ? <Sun className="w-3.5 h-3.5 mr-2" /> : <Moon className="w-3.5 h-3.5 mr-2" />}
          Toggle theme
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
