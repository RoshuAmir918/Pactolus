"use client";

import { WorkspaceLayout } from "@/components/workspace";

export default function WorkspacePage() {
  return (
    <WorkspaceLayout>
      <p className="text-sm text-muted-foreground">
        This is your main workspace area. Add cards, tables, and other components
        here.
      </p>
    </WorkspaceLayout>
  );
}
