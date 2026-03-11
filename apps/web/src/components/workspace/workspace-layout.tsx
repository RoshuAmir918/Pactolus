"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, ChevronRight, FolderKanban } from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuSub,
} from "@/components/ui/sidebar";

import { Button } from "@/components/ui/button";

type WorkspaceLayoutProps = {
  /** Main content to the right of the sidebar */
  children: React.ReactNode;
  /** Optional title shown in the top bar next to the sidebar trigger */
  title?: string;
  /** Optional actions (e.g. "Home" link) shown in the top bar */
  headerActions?: React.ReactNode;
};

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

/**
 * Reusable workspace shell: sidebar nav + main area.
 * Use on any page that should share the same sidebar (e.g. /workspace, /workspace/snapshots).
 */
export function WorkspaceLayout({
  children,
  title = "Workspace",
  headerActions,
}: WorkspaceLayoutProps) {
  const [selectedOrgId, setSelectedOrgId] = useState(DEMO_ORGS[0]?.id);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(
    DEMO_ORGS[0]?.snapshots[0]?.id,
  );

  const selectedOrg = useMemo(
    () => DEMO_ORGS.find((org) => org.id === selectedOrgId) ?? DEMO_ORGS[0],
    [selectedOrgId],
  );

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" className="cursor-default">
                  <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                    <Building2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{selectedOrg.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {selectedOrg.plan}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarGroup>
            <SidebarGroupLabel>Clients</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {DEMO_ORGS.map((org) => {
                  const isSelectedOrg = org.id === selectedOrgId;
                  return (
                    <SidebarMenuItem key={org.id}>
                      <SidebarMenuButton
                        isActive={isSelectedOrg}
                        onClick={() => {
                          setSelectedOrgId(org.id);
                          if (!org.snapshots.some((s) => s.id === selectedSnapshotId)) {
                            setSelectedSnapshotId(org.snapshots[0]?.id);
                          }
                        }}
                      >
                        <FolderKanban className="size-4" />
                        <span>{org.name}</span>
                        <ChevronRight
                          className={`ml-auto size-4 transition-transform ${
                            isSelectedOrg ? "rotate-90" : ""
                          }`}
                        />
                      </SidebarMenuButton>

                      {isSelectedOrg ? (
                        <SidebarMenuSub>
                          {org.snapshots.map((snapshot) => (
                            <SidebarMenuSubItem key={snapshot.id}>
                              <SidebarMenuSubButton
                                isActive={selectedSnapshotId === snapshot.id}
                                onClick={() => setSelectedSnapshotId(snapshot.id)}
                              >
                                <span>{snapshot.name}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          {headerActions ?? (
            <Button asChild variant="outline">
              <Link href="/">Home</Link>
            </Button>
          )}
        </header>

        <main className="p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
