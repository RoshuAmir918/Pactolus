import type { ComponentType } from "react";
import { CreditCard, LayoutDashboard, Users } from "lucide-react";

export type SettingsTabId = "overview" | "members" | "billing";

export type SettingsNavItem = {
  id: SettingsTabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "members", label: "Members", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
];

export function settingsTabLabel(id: SettingsTabId): string {
  const item = SETTINGS_NAV_ITEMS.find((entry) => entry.id === id);
  return item?.label ?? "Settings";
}

/** Resolve active settings tab from pathname (e.g. `/settings/members` → `members`). */
export function settingsTabFromPathname(pathname: string | null): SettingsTabId {
  if (!pathname) return "overview";
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (last === "settings" || !last) return "overview";
  const candidate = last as SettingsTabId;
  return SETTINGS_NAV_ITEMS.some((item) => item.id === candidate) ? candidate : "overview";
}
