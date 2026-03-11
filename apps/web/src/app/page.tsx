"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAtomValue, useSetAtom } from "jotai";
import { authUserAtom } from "@/stores/auth";
import { getMe } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";

export default function Home() {
  const user = useAtomValue(authUserAtom);
  const setUser = useSetAtom(authUserAtom);

  useEffect(() => {
    getMe().then(setUser);
  }, [setUser]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Pactolus</h1>
      {user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">You are logged in.</p>
          <div className="flex gap-3">
            <Button asChild variant="default">
              <Link href="/workspace">Workspace</Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      ) : (
        <Button asChild>
          <Link href="/login">Log in</Link>
        </Button>
      )}
    </div>
  );
}
