"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "@/components/workspace/sidebar/workspace-sidebar";
type WorkspaceLayoutProps = {
  /** Main content to the right of the sidebar */
  children: React.ReactNode;
  /** Optional title shown in the top bar next to the sidebar trigger */
  title?: string;
  /** Optional actions (e.g. "Home" link) shown in the top bar */
  headerActions?: React.ReactNode;
};

/**
 * Reusable workspace shell: sidebar nav + main area.
 * Use on any page that should share the same sidebar (e.g. /workspace, /workspace/snapshots).
 */
export function WorkspaceLayout({
  children,
  title = "Workspace",
  headerActions,
}: WorkspaceLayoutProps) {
  return (
    <SidebarProvider>
      <WorkspaceSidebar />

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
