"use client";

import { Lightbulb } from "lucide-react";
import { useCallback, useEffect } from "react";

import { cn } from "@/lib/utils";

function isEditableFocus(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  const editable = target.closest("[contenteditable]");
  return editable?.getAttribute("contenteditable") === "true";
}

type ChromeTopBarActionsProps = {
  className?: string;
};

/**
 * Resend-style header actions: Feedback (shortcut F), Help, Docs.
 * Wired as placeholders until product routes exist.
 */
export function ChromeTopBarActions({ className }: ChromeTopBarActionsProps) {
  const onFeedback = useCallback(() => {
    // Placeholder: hook up feedback modal or external URL later.
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableFocus(event.target)) {
        return;
      }
      event.preventDefault();
      onFeedback();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onFeedback]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-1 sm:gap-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={onFeedback}
        className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Lightbulb className="size-3.5 shrink-0 opacity-80" aria-hidden />
        <span>Feedback</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          F
        </kbd>
      </button>
      <button
        type="button"
        className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Help
      </button>
      <button
        type="button"
        className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Docs
      </button>
    </div>
  );
}
