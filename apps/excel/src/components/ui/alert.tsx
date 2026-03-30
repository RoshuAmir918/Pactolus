import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
}) {
  return (
    <div
      className={cn(
        "relative w-full rounded-lg border p-3 text-sm",
        variant === "destructive"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-sky-200 bg-sky-50 text-sky-800",
        className,
      )}
      role="alert"
      {...props}
    />
  );
}
