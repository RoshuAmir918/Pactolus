"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_TOOLS } from "@/components/admin/admin-nav";

const segmentIcon = {
  "create-organization": Building2,
} as const;

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/30">
      <div className="border-b border-border px-4 py-4">
        <Link
          href="/admin/create-organization"
          prefetch={false}
          className="text-sm font-semibold tracking-tight text-foreground hover:underline"
        >
          Admin
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">Tools</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {ADMIN_TOOLS.map((tool) => {
          const href = `/admin/${tool.segment}`;
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          const Icon =
            segmentIcon[tool.segment as keyof typeof segmentIcon] ?? Building2;
          return (
            <Link
              key={tool.segment}
              href={href}
              prefetch={false}
              className={cn(
                "flex flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
                {tool.label}
              </span>
              <span className="pl-6 text-xs font-normal text-muted-foreground">
                {tool.description}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
