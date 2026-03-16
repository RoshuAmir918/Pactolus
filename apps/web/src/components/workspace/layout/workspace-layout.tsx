"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceContentArea } from "@/components/workspace/content/workspace-content-area";
import { WorkspaceSidebar } from "@/components/workspace/sidebar/workspace-sidebar";
import { useWorkspaceBootstrap } from "@/hooks/use-workspace-bootstrap";

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
  useWorkspaceBootstrap();

  return (
    <SidebarProvider>
      <WorkspaceSidebar />
      <WorkspaceContentArea title={title} headerActions={headerActions}>
        {children}
      </WorkspaceContentArea>
    </SidebarProvider>
  );
}
