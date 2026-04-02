"use client";

import { usePathname } from "next/navigation";

import { SettingsShell } from "@/components/settings/settings-shell";
import { SETTINGS_NAV_ITEMS, settingsTabFromPathname } from "@/components/settings/settings-nav";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const activeId = settingsTabFromPathname(pathname);

  return (
    <SettingsShell
      description="Organization & billing"
      navItems={SETTINGS_NAV_ITEMS}
      activeId={activeId}
    >
      {children}
    </SettingsShell>
  );
}
