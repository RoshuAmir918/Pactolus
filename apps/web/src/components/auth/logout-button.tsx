"use client";

import { useSetAtom } from "jotai";
import { authUserAtom } from "@/stores/auth";
import { logout } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const setUser = useSetAtom(authUserAtom);

  async function handleLogout() {
    await logout();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Log out
    </Button>
  );
}
