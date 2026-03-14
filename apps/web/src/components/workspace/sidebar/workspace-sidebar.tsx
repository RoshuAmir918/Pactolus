"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { MoreHorizontal, Plus } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/workspace/sidebar/account-menu";
import { ClientViewItem } from "@/components/workspace/sidebar/client-view";
import { SidebarPaneHeader } from "@/components/workspace/sidebar/sidebar-pane-header";
import { SnapshotExplorerView } from "@/components/workspace/sidebar/snapshot-explorer-view";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { demoOrgsAtom, type DemoOrg } from "@/stores/workspace";
import {
  activeClientIdAtom,
  activeSnapshotIdAtom,
  leftPaneModeAtom,
} from "@/stores/workspace-ui";

const RECENT_ORGS_STORAGE_KEY = "pactolus_recent_orgs";
const VIEWS_STORAGE_KEY = "pactolus_workspace_client_views";
const DEFAULT_WORKSPACE_ID = "space-default";

// Multi-workspace persistence is temporarily disabled for this flow.
// const SPACES_STORAGE_KEY = "pactolus_workspace_spaces";
//
// type WorkspaceSpace = {
//   id: string;
//   name: string;
// };

type ClientView = {
  id: string;
  orgId: string;
  snapshotId?: string;
  openFolders?: Record<string, boolean>;
  collapsed?: boolean;
};

function fuzzyMatch(query: string, text: string) {
  if (!query) return true;
  query = query.toLowerCase();
  text = text.toLowerCase();

  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      qi++;
    }
  }

  return qi === query.length;
}

function findOrg(orgs: DemoOrg[], orgId: string): DemoOrg | undefined {
  return orgs.find((org) => org.id === orgId) ?? orgs[0];
}

function firstSnapshotId(org: DemoOrg): string | undefined {
  return org.snapshots[0]?.id;
}

function loadViewsForSpace(spaceId: string, orgs: DemoOrg[]): ClientView[] {
    const firstOrg = orgs[0];
    if (!firstOrg) {
      return [];
    }

    if (typeof window === "undefined") {
      return [
        {
          id: "view-1",
          orgId: firstOrg.id,
          snapshotId: firstSnapshotId(firstOrg),
          openFolders: {},
          collapsed: false,
        },
      ];
    }

    try {
      const stored = window.localStorage.getItem(`${VIEWS_STORAGE_KEY}:${spaceId}`);
      if (!stored) {
        return [
          {
            id: "view-1",
            orgId: firstOrg.id,
            snapshotId: firstSnapshotId(firstOrg),
            openFolders: {},
            collapsed: false,
          },
        ];
      }

      const rawViews = JSON.parse(stored) as ClientView[];
      if (!Array.isArray(rawViews) || rawViews.length === 0) {
        return [
          {
            id: "view-1",
            orgId: firstOrg.id,
            snapshotId: firstSnapshotId(firstOrg),
            openFolders: {},
            collapsed: false,
          },
        ];
      }

      return rawViews.map((v, index) => {
        const org = findOrg(orgs, v.orgId);
        if (!org) {
          return {
            id: v.id ?? `view-${index}`,
            orgId: "",
            snapshotId: undefined,
            openFolders: v.openFolders ?? {},
            collapsed: v.collapsed ?? false,
          };
        }
        const snapshotId = org.snapshots.some((s) => s.id === v.snapshotId)
          ? v.snapshotId
          : firstSnapshotId(org);

        return {
          id: v.id ?? `view-${org.id}-${index}`,
          orgId: org.id,
          snapshotId,
          openFolders: v.openFolders ?? {},
          collapsed: v.collapsed ?? false,
        };
      });
    } catch {
      return [
        {
          id: "view-1",
          orgId: firstOrg.id,
          snapshotId: firstSnapshotId(firstOrg),
          openFolders: {},
          collapsed: false,
        },
      ];
    }
  }

export function WorkspaceSidebar() {
  const [demoOrgs, setDemoOrgs] = useAtom(demoOrgsAtom);
  const [leftPaneMode, setLeftPaneMode] = useAtom(leftPaneModeAtom);
  const [activeClientId] = useAtom(activeClientIdAtom);
  const [activeSnapshotId] = useAtom(activeSnapshotIdAtom);
  // Multi-workspace state is intentionally paused for now.
  // const [spacesState, setSpacesState] = useState<{
  //   spaces: WorkspaceSpace[];
  //   activeSpaceId: string;
  // }>(() => ({
  //   spaces: [{ id: DEFAULT_WORKSPACE_ID, name: "Unnamed Workspace" }],
  //   activeSpaceId: DEFAULT_WORKSPACE_ID,
  // }));
  // const { spaces, activeSpaceId } = spacesState;

  const [views, setViews] = useState<ClientView[]>(() => {
    return loadViewsForSpace(DEFAULT_WORKSPACE_ID, demoOrgs);
  });
  const [recentOrgIds, setRecentOrgIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(RECENT_ORGS_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [clientSearch, setClientSearch] = useState("");
  const [showExpandedClientList, setShowExpandedClientList] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSelection, setActiveSelection] = useState<
    { viewId: string; snapshotId: string } | undefined
  >(undefined);
  const [addViewOpen, setAddViewOpen] = useState(false);
  const [addViewSearch, setAddViewSearch] = useState("");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [createSnapshotDialogOpen, setCreateSnapshotDialogOpen] = useState(false);
  const [createSnapshotClientId, setCreateSnapshotClientId] = useState("");
  const [createSnapshotName, setCreateSnapshotName] = useState("");

  useEffect(() => {
    setIsHydrated(true);
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify(views);
      window.localStorage.setItem(`${VIEWS_STORAGE_KEY}:${DEFAULT_WORKSPACE_ID}`, payload);
    } catch {
      // ignore storage errors
    }
  }, [views]);

  // Multi-workspace hydration and persistence is intentionally disabled.
  // useEffect(() => {
  //   if (typeof window === "undefined") return;
  //   try {
  //     const stored = window.localStorage.getItem(SPACES_STORAGE_KEY);
  //     if (!stored) return;
  //     const parsed = JSON.parse(stored) as {
  //       spaces?: WorkspaceSpace[];
  //       activeSpaceId?: string;
  //     };
  //     const nextSpaces =
  //       parsed.spaces && parsed.spaces.length > 0
  //         ? parsed.spaces
  //         : [{ id: DEFAULT_WORKSPACE_ID, name: "Unnamed Workspace" }];
  //     const nextActiveSpaceId = parsed.activeSpaceId ?? nextSpaces[0]!.id;
  //     setSpacesState({ spaces: nextSpaces, activeSpaceId: nextActiveSpaceId });
  //   } catch {
  //     // ignore
  //   }
  // }, []);
  //
  // useEffect(() => {
  //   if (typeof window === "undefined") return;
  //   try {
  //     const payload = JSON.stringify(spacesState);
  //     window.localStorage.setItem(SPACES_STORAGE_KEY, payload);
  //   } catch {
  //     // ignore
  //   }
  // }, [spacesState]);

  const persistRecent = (next: string[]) => {
    setRecentOrgIds(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(RECENT_ORGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore localStorage errors
    }
  };

  const handleChangeOrg = (viewId: string, orgId: string) => {
    setViews((prev) =>
      prev.map((view) => {
        if (view.id !== viewId) return view;
        const org = findOrg(demoOrgs, orgId);
        if (!org) return view;
        const hasSnapshot = org.snapshots.some((s) => s.id === view.snapshotId);
        return {
          ...view,
          orgId,
          snapshotId:
            hasSnapshot && view.snapshotId ? view.snapshotId : firstSnapshotId(org),
          // When swapping clients in an existing view, reset its folder open/closed state
          openFolders: {},
        };
      }),
    );

    const nextRecent = [orgId, ...recentOrgIds.filter((id) => id !== orgId)].slice(
      0,
      8,
    );
    persistRecent(nextRecent);
  };

  const handleChangeSnapshot = (viewId: string, snapshotId: string) => {
    setViews((prev) =>
      prev.map((view) =>
        view.id === viewId
          ? {
              ...view,
              snapshotId,
            }
          : view,
      ),
    );
    setActiveSelection({ viewId, snapshotId });
  };

  const handleAddView = () => {
    setAddViewOpen(true);
  };

  const handleRemoveView = (viewId: string) => {
    setViews((prev) => prev.filter((view) => view.id !== viewId));
  };

  // Multi-workspace handlers are intentionally disabled for now.
  // const handleChangeSpace = (spaceId: string) => {
  //   setSpacesState((prev) => ({
  //     ...prev,
  //     activeSpaceId: spaceId,
  //   }));
  //   setViews(loadViewsForSpace(spaceId, demoOrgs));
  //   setActiveSelection(undefined);
  //   setLeftPaneMode("clients");
  //   setActiveClientId(null);
  //   setActiveSnapshotId(null);
  // };
  //
  // const handleAddSpace = () => {
  //   const id = `space-${Date.now()}`;
  //   const name = "Unnamed Workspace";
  //
  //   const nextSpaces = [...spaces, { id, name }];
  //   setSpacesState({
  //     spaces: nextSpaces,
  //     activeSpaceId: id,
  //   });
  //   const firstOrg = demoOrgs[0];
  //   if (!firstOrg) return;
  //   setViews([
  //     {
  //       id: "view-1",
  //       orgId: firstOrg.id,
  //       snapshotId: firstSnapshotId(firstOrg),
  //       openFolders: {},
  //       collapsed: false,
  //     },
  //   ]);
  //   setActiveSelection(
  //     firstOrg.snapshots[0]?.id
  //       ? { viewId: "view-1", snapshotId: firstOrg.snapshots[0].id }
  //       : undefined,
  //   );
  //   setLeftPaneMode("clients");
  //   setActiveClientId(null);
  //   setActiveSnapshotId(null);
  // };
  //
  // const handleRenameSpace = (spaceId: string, nextName: string) => {
  //   const trimmed = nextName.trim();
  //   if (!trimmed) return;
  //   setSpacesState((prev) => ({
  //     ...prev,
  //     spaces: prev.spaces.map((space) =>
  //       space.id === spaceId ? { ...space, name: trimmed } : space,
  //     ),
  //   }));
  // };
  //
  // const handleDeleteSpace = (spaceId: string) => {
  //   if (spaces.length <= 1) return;
  //   const remaining = spaces.filter((s) => s.id !== spaceId);
  //   const nextActive =
  //     spaceId === activeSpaceId ? remaining[0]?.id ?? activeSpaceId : activeSpaceId;
  //   setSpacesState({
  //     spaces: remaining,
  //     activeSpaceId: nextActive,
  //   });
  //   if (typeof window !== "undefined") {
  //     try {
  //       window.localStorage.removeItem(`${VIEWS_STORAGE_KEY}:${spaceId}`);
  //     } catch {
  //       // ignore
  //     }
  //   }
  //   setViews(loadViewsForSpace(nextActive, demoOrgs));
  //   setActiveSelection(undefined);
  //   setLeftPaneMode("clients");
  //   setActiveClientId(null);
  //   setActiveSnapshotId(null);
  // };

  const buildDefaultSnapshotName = (snapshotCount: number) => {
    const nextIndex = snapshotCount + 1;
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = monthNames[(nextIndex - 1) % monthNames.length] ?? "January";
    const year = 2026 - Math.floor((nextIndex - 1) / monthNames.length);
    return `${month} ${year}`;
  };

  const createSnapshotForOrg = (orgId: string, customName?: string) => {
    const org = findOrg(demoOrgs, orgId);
    if (!org) return;

    const snapshotName = customName?.trim() || buildDefaultSnapshotName(org.snapshots.length);
    const snapshotId = `${org.id}-snapshot-${Date.now()}`;

    setDemoOrgs((prev) =>
      prev.map((candidate) =>
        candidate.id === org.id
          ? {
              ...candidate,
              snapshots: [
                {
                  id: snapshotId,
                  name: snapshotName,
                  sections: [
                    {
                      id: "raw-data",
                      name: "Raw data",
                      files: [
                        {
                          id: `${snapshotId}-raw-1`,
                          name: "raw_extract.xlsx",
                        },
                        {
                          id: `${snapshotId}-raw-2`,
                          name: "claims_extract.csv",
                        },
                      ],
                    },
                    {
                      id: "runs",
                      name: "Runs",
                      files: [{ id: `${snapshotId}-run-1`, name: "scenario_run.csv" }],
                    },
                    {
                      id: "notes",
                      name: "Notes",
                      files: [{ id: `${snapshotId}-note-1`, name: "notes.csv" }],
                    },
                  ],
                },
                ...candidate.snapshots,
              ],
            }
          : candidate,
      ),
    );
    setHeaderMenuOpen(false);
  };

  const headerClientTargets = useMemo(() => {
    const seen = new Set<string>();
    const ordered: DemoOrg[] = [];
    for (const view of views) {
      const org = findOrg(demoOrgs, view.orgId);
      if (!org || seen.has(org.id)) continue;
      seen.add(org.id);
      ordered.push(org);
    }
    return ordered;
  }, [demoOrgs, views]);

  const openCreateSnapshotDialog = () => {
    const firstClient = headerClientTargets[0];
    if (!firstClient) {
      setHeaderMenuOpen(false);
      return;
    }
    setCreateSnapshotClientId(firstClient.id);
    setCreateSnapshotName(buildDefaultSnapshotName(firstClient.snapshots.length));
    setHeaderMenuOpen(false);
    setCreateSnapshotDialogOpen(true);
  };

  const handleSubmitCreateSnapshot = () => {
    if (!createSnapshotClientId) return;
    createSnapshotForOrg(createSnapshotClientId, createSnapshotName);
    setCreateSnapshotDialogOpen(false);
  };

  const selectedClient = activeClientId ? findOrg(demoOrgs, activeClientId) : undefined;
  const selectedSnapshot = selectedClient?.snapshots.find(
    (snapshot) => snapshot.id === activeSnapshotId,
  );
  const showSnapshotExplorer =
    leftPaneMode === "snapshot" && Boolean(selectedClient && selectedSnapshot);

  const topHeader = showSnapshotExplorer && selectedClient && selectedSnapshot ? (
    <SidebarPaneHeader
      subtitle={selectedClient.name}
      title={selectedSnapshot.name}
      onBack={() => setLeftPaneMode("clients")}
      backAriaLabel="Back to client list"
    />
  ) : (
    <SidebarPaneHeader
      title="Client View"
      subtitle="Workspace"
      actions={
        <Popover open={headerMenuOpen} onOpenChange={setHeaderMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground"
              aria-label="Client view actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="end" sideOffset={8}>
            <button
              type="button"
              onClick={openCreateSnapshotDialog}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              <span>Create snapshot</span>
              <Plus className="ml-2 size-3 text-muted-foreground" />
            </button>
          </PopoverContent>
        </Popover>
      }
    />
  );

  const handleToggleCollapsed = (viewId: string) => {
    setViews((prev) =>
      prev.map((view) =>
        view.id === viewId
          ? { ...view, collapsed: !(view.collapsed ?? false) }
          : view,
      ),
    );
  };

  const orderedOrgs = useMemo(() => {
    if (clientSearch.trim()) {
      const q = clientSearch.trim().toLowerCase();
      return demoOrgs.filter((org) =>
        fuzzyMatch(q, org.name.toLowerCase()),
      ).sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!recentOrgIds.length) {
      return [...demoOrgs].sort((a, b) => a.name.localeCompare(b.name));
    }

    const map = new Map(demoOrgs.map((o) => [o.id, o]));
    const recent = recentOrgIds
      .map((id) => map.get(id))
      .filter((o): o is DemoOrg => Boolean(o));
    const remaining = demoOrgs.filter((o) => !recentOrgIds.includes(o.id)).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    return [...recent, ...remaining];
  }, [clientSearch, demoOrgs, recentOrgIds]);

  const orderedOrgsForAdd = useMemo(() => {
    if (addViewSearch.trim()) {
      const q = addViewSearch.trim().toLowerCase();
      return demoOrgs.filter((org) =>
        fuzzyMatch(q, org.name.toLowerCase()),
      ).sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!recentOrgIds.length) {
      return [...demoOrgs].sort((a, b) => a.name.localeCompare(b.name));
    }

    const map = new Map(demoOrgs.map((o) => [o.id, o]));
    const recent = recentOrgIds
      .map((id) => map.get(id))
      .filter((o): o is DemoOrg => Boolean(o));
    const remaining = demoOrgs.filter((o) => !recentOrgIds.includes(o.id)).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    return [...recent, ...remaining];
  }, [addViewSearch, demoOrgs, recentOrgIds]);

  const createViewForOrg = (orgId: string) => {
    const org = findOrg(demoOrgs, orgId);
    if (!org) return;
    const newId = `view-${Date.now()}`;
    setViews((prev) => [
      ...prev,
      {
        id: newId,
        orgId: org.id,
        snapshotId: firstSnapshotId(org),
        openFolders: {},
      },
    ]);

    const nextRecent = [org.id, ...recentOrgIds.filter((id) => id !== org.id)].slice(
      0,
      8,
    );
    persistRecent(nextRecent);
    setActiveSelection(
      org.snapshots[0]?.id ? { viewId: newId, snapshotId: org.snapshots[0].id } : undefined,
    );
  };

  if (!isHydrated) {
    return (
      <Sidebar>
        <SidebarContent>
          <div className="flex h-full flex-col">
            {topHeader}
            <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <SidebarGroup>
                <SidebarGroupContent>
                  <div className="space-y-3 px-3 py-4">
                    <div className="h-9 rounded-md bg-sidebar-accent/40" />
                    <div className="h-8 rounded-md bg-sidebar-accent/30" />
                    <div className="h-8 rounded-md bg-sidebar-accent/20" />
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
            <AccountMenu />
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <SidebarContent>
        <div className="flex h-full flex-col">
          {topHeader}
          {showSnapshotExplorer && selectedClient && selectedSnapshot ? (
            <div className="flex-1">
              <SnapshotExplorerView snapshot={selectedSnapshot} />
            </div>
          ) : (
            <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-2.5">
                    {views.map((view) => {
                      const org = findOrg(demoOrgs, view.orgId);
                      if (!org) return null;
                      const snapshotId = view.snapshotId ?? firstSnapshotId(org);
                      const canRemove = true;

                      return (
                        <SidebarMenuItem key={view.id}>
                          <ClientViewItem
                            viewId={view.id}
                            org={org}
                            snapshotId={snapshotId}
                            activeSelection={activeSelection}
                            orderedOrgs={orderedOrgs}
                            clientSearch={clientSearch}
                            onClientSearchChange={setClientSearch}
                            showExpandedClientList={showExpandedClientList}
                            onToggleExpanded={() =>
                              setShowExpandedClientList((prev) => !prev)
                            }
                            onChangeOrg={handleChangeOrg}
                            onChangeSnapshot={handleChangeSnapshot}
                            canRemove={canRemove}
                            onRemove={handleRemoveView}
                            collapsed={view.collapsed ?? false}
                            onToggleCollapsed={handleToggleCollapsed}
                          />
                        </SidebarMenuItem>
                      );
                    })}

                    <SidebarMenuItem>
                      <Popover open={addViewOpen} onOpenChange={setAddViewOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "mt-0 flex w-full items-center justify-start gap-2 py-5 text-xs",
                              addViewOpen &&
                                "bg-sidebar-accent text-sidebar-accent-foreground",
                            )}
                            onClick={handleAddView}
                          >
                            <Plus className="size-3" />
                            Add client view
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-64 p-0 -ml-2"
                          side="right"
                          align="start"
                          sideOffset={10}
                        >
                          <Command>
                            <CommandInput
                              placeholder="Search clients..."
                              value={addViewSearch}
                              onValueChange={setAddViewSearch}
                            />
                            <CommandList className="max-h-60 overflow-y-auto">
                              <CommandEmpty>No clients found.</CommandEmpty>
                              <CommandGroup heading="Clients">
                                {orderedOrgsForAdd.map((org) => (
                                  <CommandItem
                                    key={org.id}
                                    value={org.name}
                                    className="cursor-pointer"
                                    onSelect={() => {
                                      createViewForOrg(org.id);
                                      setAddViewSearch("");
                                      setAddViewOpen(false);
                                    }}
                                  >
                                    <div className="mr-2 flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                                      {org.name.trim().charAt(0).toUpperCase() || "?"}
                                    </div>
                                    <div className="flex flex-1 flex-col text-left">
                                      <span className="truncate text-sm font-medium">
                                        {org.name}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                            <CommandSeparator />
                            <div className="flex items-center justify-between gap-2 px-2 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="cursor-pointer text-xs"
                                onClick={() =>
                                  setShowExpandedClientList((prev) => !prev)
                                }
                              >
                                {showExpandedClientList ? "View less" : "View more"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="cursor-pointer text-xs text-destructive hover:text-destructive"
                                onClick={() => setAddViewOpen(false)}
                              >
                                Remove view
                              </Button>
                            </div>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          )}

          <AccountMenu />
        </div>
        {createSnapshotDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg">
              <div className="mb-3">
                <h2 className="text-sm font-semibold">Create snapshot</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose a client and snapshot name.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="create-snapshot-client" className="text-xs text-muted-foreground">
                    Client
                  </label>
                  <select
                    id="create-snapshot-client"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={createSnapshotClientId}
                    onChange={(event) => {
                      const nextClientId = event.target.value;
                      setCreateSnapshotClientId(nextClientId);
                      const nextOrg = findOrg(demoOrgs, nextClientId);
                      if (nextOrg) {
                        setCreateSnapshotName(buildDefaultSnapshotName(nextOrg.snapshots.length));
                      }
                    }}
                  >
                    {headerClientTargets.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="create-snapshot-name" className="text-xs text-muted-foreground">
                    Snapshot name
                  </label>
                  <Input
                    id="create-snapshot-name"
                    value={createSnapshotName}
                    onChange={(event) => setCreateSnapshotName(event.target.value)}
                    placeholder="June 2026"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setCreateSnapshotDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitCreateSnapshot}
                  disabled={!createSnapshotClientId}
                >
                  Create snapshot
                </Button>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

