"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

type SidebarPaneHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backAriaLabel?: string;
  actions?: ReactNode;
};

export function SidebarPaneHeader({
  title,
  subtitle,
  onBack,
  backAriaLabel = "Back",
  actions,
}: SidebarPaneHeaderProps) {
  return (
    <div className="shrink-0 border-b border-sidebar-border bg-sidebar-border/30 px-3 py-2">
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          {subtitle ? (
            <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
          ) : null}
          <div className="truncate text-sm font-semibold text-sidebar-foreground">{title}</div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-0.5 px-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground"
            aria-label={backAriaLabel}
          >
            <ChevronLeft className="size-3" />
          </button>
        ) : (
          <div className="h-5 w-5" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
