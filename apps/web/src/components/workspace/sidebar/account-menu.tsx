import { useState } from "react";
import {
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
  User,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DEMO_USER = {
  name: "Alex Doe",
  email: "alex@example.com",
};

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function AccountMenu() {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <div className="mt-auto border-t border-sidebar-border px-2 py-2">
      <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-sidebar-primary/80 text-xs font-semibold text-sidebar-primary-foreground">
              {getInitial(DEMO_USER.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{DEMO_USER.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {DEMO_USER.email}
              </div>
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-1 -ml-2"
          side="right"
          align="end"
          sideOffset={10}
        >
          <div className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm">
            <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary/80 text-sm font-semibold text-sidebar-primary-foreground">
              {getInitial(DEMO_USER.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{DEMO_USER.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {DEMO_USER.email}
              </div>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <button className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground">
            <Sparkles className="size-3.5" />
            <span>Upgrade to Pro</span>
          </button>
          <button className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground">
            <User className="size-3.5" />
            <span>Account</span>
          </button>
          <button className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground">
            <CreditCard className="size-3.5" />
            <span>Billing</span>
          </button>
          <button className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground">
            <Bell className="size-3.5" />
            <span>Notifications</span>
          </button>
          <div className="my-1 h-px bg-border" />
          <button className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-accent/60 hover:text-red-500">
            <LogOut className="size-3.5" />
            <span>Log out</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

