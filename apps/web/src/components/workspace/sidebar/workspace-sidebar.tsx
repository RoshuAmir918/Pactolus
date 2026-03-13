"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

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
import { OrganizationHeader } from "@/components/workspace/sidebar/organization-header";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

type DemoOrg = {
  id: string;
  name: string;
  plan: string;
  snapshots: Array<{ id: string; name: string }>;
};

const DEMO_ORGS: DemoOrg[] = [
  {
    id: "org-acme",
    name: "Acme Inc",
    plan: "Enterprise",
    snapshots: [
      { id: "acme-q4", name: "Q4 2025 Baseline" },
      { id: "acme-q1", name: "Q1 2026 Renewal" },
      { id: "acme-claims", name: "Claims Deep Dive" },
    ],
  },
  {
    id: "org-orion",
    name: "Orion Risk",
    plan: "Pro",
    snapshots: [
      { id: "orion-core", name: "Core Portfolio" },
      { id: "orion-west", name: "West Region" },
    ],
  },
  {
    id: "org-boreal",
    name: "Boreal Re",
    plan: "Enterprise",
    snapshots: [
      { id: "boreal-jan", name: "January Upload" },
      { id: "boreal-feb", name: "February Upload" },
      { id: "boreal-march", name: "March Upload" },
    ],
  },
];

const RECENT_ORGS_STORAGE_KEY = "pactolus_recent_orgs";
const VIEWS_STORAGE_KEY = "pactolus_workspace_client_views";
const SPACES_STORAGE_KEY = "pactolus_workspace_spaces";

type ClientView = {
  id: string;
  orgId: string;
  snapshotId?: string;
  openFolders?: Record<string, boolean>;
  collapsed?: boolean;
};

type WorkspaceSpace = {
  id: string;
  name: string;
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

function findOrg(orgId: string): DemoOrg {
  return DEMO_ORGS.find((org) => org.id === orgId) ?? DEMO_ORGS[0];
}

function firstSnapshotId(org: DemoOrg): string | undefined {
  return org.snapshots[0]?.id;
}

function loadViewsForSpace(spaceId: string): ClientView[] {
    if (typeof window === "undefined") {
      const firstOrg = DEMO_ORGS[0];
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
        const firstOrg = DEMO_ORGS[0];
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
        const firstOrg = DEMO_ORGS[0];
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
        const org = findOrg(v.orgId);
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
      const firstOrg = DEMO_ORGS[0];
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
  const [spacesState, setSpacesState] = useState<{
    spaces: WorkspaceSpace[];
    activeSpaceId: string;
  }>(() => ({
    spaces: [{ id: "space-default", name: "Unnamed Workspace" }],
    activeSpaceId: "space-default",
  }));
  const { spaces, activeSpaceId } = spacesState;

  const [views, setViews] = useState<ClientView[]>(() => {
    const spaceId = activeSpaceId ?? "space-default";
    return loadViewsForSpace(spaceId);
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

  useEffect(() => {
    setIsHydrated(true);
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify(views);
      window.localStorage.setItem(`${VIEWS_STORAGE_KEY}:${activeSpaceId}`, payload);
    } catch {
      // ignore storage errors
    }
  }, [views, activeSpaceId]);

  // Hydrate spaces from localStorage on the client after first render
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(SPACES_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        spaces?: WorkspaceSpace[];
        activeSpaceId?: string;
      };
      const nextSpaces =
        parsed.spaces && parsed.spaces.length > 0
          ? parsed.spaces
          : [{ id: "space-default", name: "Unnamed Workspace" }];
      const nextActiveSpaceId = parsed.activeSpaceId ?? nextSpaces[0]!.id;
      setSpacesState({ spaces: nextSpaces, activeSpaceId: nextActiveSpaceId });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify(spacesState);
      window.localStorage.setItem(SPACES_STORAGE_KEY, payload);
    } catch {
      // ignore
    }
  }, [spacesState]);

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
        const org = findOrg(orgId);
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

  const handleToggleFolder = (viewId: string, folderId: string) => {
    setViews((prev) =>
      prev.map((view) =>
        view.id === viewId
          ? {
              ...view,
              openFolders: {
                ...(view.openFolders ?? {}),
                [folderId]: !view.openFolders?.[folderId],
              },
            }
          : view,
      ),
    );
  };

  const handleChangeSpace = (spaceId: string) => {
    setSpacesState((prev) => ({
      ...prev,
      activeSpaceId: spaceId,
    }));
    setViews(loadViewsForSpace(spaceId));
    setActiveSelection(undefined);
  };

  const handleAddSpace = () => {
    const id = `space-${Date.now()}`;
    const name = "Unnamed Workspace";

    const nextSpaces = [...spaces, { id, name }];
    setSpacesState({
      spaces: nextSpaces,
      activeSpaceId: id,
    });
    // Initialize views for the new space with a single default client view.
    const firstOrg = DEMO_ORGS[0];
    setViews([
      {
        id: "view-1",
        orgId: firstOrg.id,
        snapshotId: firstSnapshotId(firstOrg),
        openFolders: {},
        collapsed: false,
      },
    ]);
    setActiveSelection(
      firstOrg.snapshots[0]?.id
        ? { viewId: "view-1", snapshotId: firstOrg.snapshots[0].id }
        : undefined,
    );
  };

  const handleRenameSpace = (spaceId: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setSpacesState((prev) => ({
      ...prev,
      spaces: prev.spaces.map((space) =>
        space.id === spaceId ? { ...space, name: trimmed } : space,
      ),
    }));
  };

  const handleDeleteSpace = (spaceId: string) => {
    if (spaces.length <= 1) return;
    const remaining = spaces.filter((s) => s.id !== spaceId);
    const nextActive =
      spaceId === activeSpaceId ? remaining[0]?.id ?? activeSpaceId : activeSpaceId;
    setSpacesState({
      spaces: remaining,
      activeSpaceId: nextActive,
    });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(`${VIEWS_STORAGE_KEY}:${spaceId}`);
      } catch {
        // ignore
      }
    }
    setViews(loadViewsForSpace(nextActive));
    setActiveSelection(undefined);
  };

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
      return DEMO_ORGS.filter((org) =>
        fuzzyMatch(q, org.name.toLowerCase()),
      ).sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!recentOrgIds.length) {
      return [...DEMO_ORGS].sort((a, b) => a.name.localeCompare(b.name));
    }

    const map = new Map(DEMO_ORGS.map((o) => [o.id, o]));
    const recent = recentOrgIds
      .map((id) => map.get(id))
      .filter((o): o is DemoOrg => Boolean(o));
    const remaining = DEMO_ORGS.filter((o) => !recentOrgIds.includes(o.id)).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    return [...recent, ...remaining];
  }, [clientSearch, recentOrgIds]);

  const orderedOrgsForAdd = useMemo(() => {
    if (addViewSearch.trim()) {
      const q = addViewSearch.trim().toLowerCase();
      return DEMO_ORGS.filter((org) =>
        fuzzyMatch(q, org.name.toLowerCase()),
      ).sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!recentOrgIds.length) {
      return [...DEMO_ORGS].sort((a, b) => a.name.localeCompare(b.name));
    }

    const map = new Map(DEMO_ORGS.map((o) => [o.id, o]));
    const recent = recentOrgIds
      .map((id) => map.get(id))
      .filter((o): o is DemoOrg => Boolean(o));
    const remaining = DEMO_ORGS.filter((o) => !recentOrgIds.includes(o.id)).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    return [...recent, ...remaining];
  }, [addViewSearch, recentOrgIds]);

  const createViewForOrg = (orgId: string) => {
    const org = findOrg(orgId);
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
            <OrganizationHeader
              spaces={spaces}
              activeSpaceId={activeSpaceId}
              onSelectSpace={handleChangeSpace}
              onAddSpace={handleAddSpace}
              onDeleteSpace={handleDeleteSpace}
              onRenameSpace={handleRenameSpace}
            />
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
          <OrganizationHeader
            spaces={spaces}
            activeSpaceId={activeSpaceId}
            onSelectSpace={handleChangeSpace}
            onAddSpace={handleAddSpace}
            onDeleteSpace={handleDeleteSpace}
            onRenameSpace={handleRenameSpace}
          />
          <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2.5">
              {views.map((view) => {
                const org = findOrg(view.orgId);
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
                      openFolders={view.openFolders ?? {}}
                      onToggleFolder={handleToggleFolder}
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

          <AccountMenu />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

