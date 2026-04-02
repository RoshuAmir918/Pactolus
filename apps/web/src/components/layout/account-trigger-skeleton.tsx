"use client";

import { cn } from "@/lib/utils";

/**
 * Matches the account menu / settings footer trigger row (avatar, two text lines, chevron slot)
 * so dynamic `loading` placeholders don’t shift layout when the real component mounts.
 */
export function AccountTriggerSkeleton({
  variant,
}: {
  variant: "settings" | "workspace";
}) {
  const isWorkspace = variant === "workspace";

  return (
    <div
      className={cn(
        "border-t px-2 py-2",
        isWorkspace ? "mt-auto border-sidebar-border" : "border-border",
      )}
      aria-hidden
    >
      <div
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        )}
      >
        <div
          className={cn(
            "size-7 shrink-0 rounded-full",
            isWorkspace ? "bg-sidebar-accent/40" : "bg-muted/30",
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* text-xs → ~1rem line box */}
          <div
            className={cn(
              "h-4 w-28 max-w-full rounded",
              isWorkspace ? "bg-sidebar-accent/30" : "bg-muted/30",
            )}
          />
          {/* text-[11px] → ~14px line box */}
          <div
            className={cn(
              "h-[14px] w-36 max-w-full rounded",
              isWorkspace ? "bg-sidebar-accent/25" : "bg-muted/25",
            )}
          />
        </div>
        {/* ChevronsUpDown size-4 */}
        <div
          className={cn(
            "size-4 shrink-0 rounded-sm",
            isWorkspace ? "bg-sidebar-accent/25" : "bg-muted/20",
          )}
        />
      </div>
    </div>
  );
}
