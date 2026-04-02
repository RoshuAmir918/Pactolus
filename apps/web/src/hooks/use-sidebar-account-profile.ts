"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import {
  ACCOUNT_DISPLAY_CACHE_EVENT,
  getAccountDisplayCacheRaw,
  parseAccountDisplayCacheRaw,
} from "@/lib/account-display-cache";
import { getMe } from "@/lib/auth-client";
import { authUserAtom } from "@/stores/auth";

function subscribeAccountDisplayCache(callback: () => void): () => void {
  if (!("addEventListener" in globalThis)) {
    return () => {};
  }
  const w = globalThis as Window & typeof globalThis;
  const handler = () => callback();
  w.addEventListener(ACCOUNT_DISPLAY_CACHE_EVENT, handler);
  w.addEventListener("storage", handler);
  return () => {
    w.removeEventListener(ACCOUNT_DISPLAY_CACHE_EVENT, handler);
    w.removeEventListener("storage", handler);
  };
}

function getAccountDisplayCacheSnapshot(): string | null {
  return getAccountDisplayCacheRaw();
}

function getServerAccountDisplaySnapshot(): null {
  return null;
}

/**
 * Hydrates the sidebar/footer name + email from localStorage before `/auth/me`
 * resolves, then prefers the live session user from Jotai.
 */
export function useSidebarAccountProfile() {
  const user = useAtomValue(authUserAtom);
  const setUser = useSetAtom(authUserAtom);

  const rawCache = useSyncExternalStore(
    subscribeAccountDisplayCache,
    getAccountDisplayCacheSnapshot,
    getServerAccountDisplaySnapshot,
  );

  const cachedUser = useMemo(
    () => parseAccountDisplayCacheRaw(rawCache),
    [rawCache],
  );

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {});
  }, [setUser]);

  const effective = user ?? cachedUser;
  return {
    displayName: effective?.fullName ?? "Your account",
    displayEmail: effective?.email ?? "",
    setUser,
  };
}
