"use client";

import { ChevronLeft } from "lucide-react";

type SnapshotExplorerHeaderProps = {
  clientName: string;
  snapshotName: string;
  onBack: () => void;
};

export function SnapshotExplorerHeader({
  clientName,
  snapshotName,
  onBack,
}: SnapshotExplorerHeaderProps) {
  return (
    <div className="border-b border-sidebar-border px-3 py-2.5">
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground"
          aria-label="Back to client list"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-[11px] text-muted-foreground">{clientName}</div>
          <div className="truncate text-sm font-semibold text-sidebar-foreground">
            {snapshotName}
          </div>
        </div>
      </div>
    </div>
  );
}
