"use client";

import { ChromeTopBarActions } from "@/components/layout/chrome-top-bar-actions";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

type WorkspaceContentAreaProps = {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
};

export function WorkspaceContentArea({
  children,
  headerActions,
}: WorkspaceContentAreaProps) {
  return (
    <SidebarInset>
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger />
          {headerActions}
        </div>
        <ChromeTopBarActions className="shrink-0" />
      </header>

      <main className="p-4">{children}</main>
    </SidebarInset>
  );
}
