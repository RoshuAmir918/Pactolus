"use client";

import {
  FileStack,
  LayoutPanelTop,
  Search,
  Settings,
  Building2,
} from "lucide-react";

const DEMO_ORGANIZATION = {
  name: "Pactolus",
  plan: "Enterprise",
};

const TOOLS = [
  { id: "files", icon: FileStack, label: "Files" },
  { id: "search", icon: Search, label: "Search" },
  { id: "layout", icon: LayoutPanelTop, label: "Layout" },
  { id: "settings", icon: Settings, label: "Settings" },
] as const;

export function OrganizationHeader() {
  return (
    <div className="shrink-0 border-b border-sidebar-border bg-sidebar-border/30 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground">
          <Building2 className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Your organization
          </div>
          <div className="truncate text-sm font-medium text-sidebar-foreground">
            {DEMO_ORGANIZATION.name}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-0.5">
        {TOOLS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className="flex cursor-pointer items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title={label}
            aria-label={label}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
