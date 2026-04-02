"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}

/** Matches account popover row styling; use in sidebar/settings footers. */
export function ThemeToggleMenuItem() {
  const { theme, toggleTheme } = useTheme();
  const nextIsLight = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
      aria-label={nextIsLight ? "Switch to light theme" : "Switch to dark theme"}
    >
      {nextIsLight ? (
        <Sun className="size-3.5 shrink-0" />
      ) : (
        <Moon className="size-3.5 shrink-0" />
      )}
      <span>{nextIsLight ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
