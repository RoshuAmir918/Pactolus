"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, LayoutDashboard, LogOut } from "lucide-react";

import { ThemeToggleMenuItem } from "@/components/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth-client";
import { useSidebarAccountProfile } from "@/hooks/use-sidebar-account-profile";

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function SettingsAccountFooter() {
  const [open, setOpen] = useState(false);
  const { displayName, displayEmail, setUser } = useSidebarAccountProfile();

  async function handleLogout() {
    await logout();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <div className="border-t border-border px-2 py-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/80"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {getInitial(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{displayName}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {displayEmail}
              </div>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-1"
          side="right"
          align="end"
          sideOffset={10}
        >
          <div className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {getInitial(displayName)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{displayName}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {displayEmail}
              </div>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/workspace"
            onClick={() => setOpen(false)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <LayoutDashboard className="size-3.5" />
            <span>Back to workspace</span>
          </Link>
          <ThemeToggleMenuItem />
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-accent/60 hover:text-red-500"
          >
            <LogOut className="size-3.5" />
            <span>Log out</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
