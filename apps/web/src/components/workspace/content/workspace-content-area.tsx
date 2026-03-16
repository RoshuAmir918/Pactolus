"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

type WorkspaceContentAreaProps = {
  children: React.ReactNode;
  title: string;
  headerActions?: React.ReactNode;
};

export function WorkspaceContentArea({
  children,
  title,
  headerActions,
}: WorkspaceContentAreaProps) {
  return (
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
  );
}
