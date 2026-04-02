"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceContentArea } from "@/components/workspace/content/workspace-content-area";
import { WorkspaceSidebar } from "@/components/workspace/sidebar/workspace-sidebar";
import { useWorkspaceBootstrap } from "@/hooks/use-workspace-bootstrap";

type WorkspaceLayoutProps = {
  /** Main content to the right of the sidebar */
  children: React.ReactNode;
  /** Optional controls to the right of the sidebar trigger in the top bar */
  headerActions?: React.ReactNode;
};

/**
 * Reusable workspace shell: sidebar nav + main area.
 * Use on any page that should share the same sidebar (e.g. /workspace, /workspace/snapshots).
 */
export function WorkspaceLayout({
  children,
  headerActions,
}: WorkspaceLayoutProps) {
  useWorkspaceBootstrap();

  return (
    <SidebarProvider>
      <WorkspaceSidebar />
      <WorkspaceContentArea headerActions={headerActions}>{children}</WorkspaceContentArea>
    </SidebarProvider>
  );
}
