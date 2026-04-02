"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type ReactNode } from "react";

import { AccountTriggerSkeleton } from "@/components/layout/account-trigger-skeleton";
import { ChromeTopBarActions } from "@/components/layout/chrome-top-bar-actions";
import type { SettingsNavItem, SettingsTabId } from "@/components/settings/settings-nav";
import { cn } from "@/lib/utils";

const SettingsAccountFooter = dynamic(
  () =>
    import("@/components/settings/settings-account-footer").then((m) => ({
      default: m.SettingsAccountFooter,
    })),
  {
    ssr: false,
    loading: () => <AccountTriggerSkeleton variant="settings" />,
  },
);

type SettingsShellProps = {
  description?: string;
  navItems: SettingsNavItem[];
  activeId: SettingsTabId;
  children: ReactNode;
};

export function SettingsShell({
  description,
  navItems,
  activeId,
  children,
}: SettingsShellProps) {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="flex w-[calc(18rem-40px)] shrink-0 flex-col border-r border-border bg-muted/25">
        <div className="border-b border-border px-4 py-5">
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <nav
          className="flex flex-1 flex-col gap-0.5 p-2"
          aria-label="Settings sections"
        >
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeId === id;
            return (
              <Link
                key={id}
                href={`/settings/${id}`}
                role="tab"
                aria-selected={isActive}
                id={`settings-tab-${id}`}
                aria-controls={`settings-panel-${id}`}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                {label}
              </Link>
            );
          })}
        </nav>

        <SettingsAccountFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-border px-6 py-3">
          <ChromeTopBarActions />
        </header>
        <div
          role="tabpanel"
          id={`settings-panel-${activeId}`}
          aria-labelledby={`settings-tab-${activeId}`}
          className="flex-1 overflow-auto"
        >
          <div className="mx-auto w-full max-w-[1150px] px-6 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
