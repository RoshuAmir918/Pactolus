import type { PropsWithChildren } from "react";
import { Badge } from "@/components/ui/badge";

export function StepLayout({
  stepLabel,
  title,
  subtitle,
  wide = false,
  children,
}: PropsWithChildren<{
  stepLabel: string;
  title: string;
  subtitle: string;
  wide?: boolean;
}>) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50 px-4 py-5">
      <div className={`mx-auto flex flex-col gap-3 ${wide ? "max-w-6xl" : "max-w-xl"}`}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <Badge variant="secondary">{stepLabel}</Badge>
        </div>
        <p className="text-sm text-slate-600">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
