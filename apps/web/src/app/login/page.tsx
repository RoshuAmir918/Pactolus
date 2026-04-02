"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";

function LoginFormWithRedirect() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  return <LoginForm redirectTo={next && next.startsWith("/") ? next : null} />;
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LoginFormWithRedirect />
      </Suspense>
    </div>
  );
}
