import type { AuthUser } from "@/lib/trpc";

const STORAGE_KEY = "pactolus_account_display_v1";

/** Same-tab listeners (storage event only fires across tabs). */
export const ACCOUNT_DISPLAY_CACHE_EVENT = "pactolus:account-display-cache";

function hasLocalStorage(): boolean {
  try {
    return "localStorage" in globalThis;
  } catch {
    return false;
  }
}

function notifyCacheListeners(): void {
  try {
    if ("dispatchEvent" in globalThis) {
      globalThis.dispatchEvent(new Event(ACCOUNT_DISPLAY_CACHE_EVENT));
    }
  } catch {
    // ignore
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null) {
    return false;
  }
  return Object.prototype.toString.call(value) === "[object Object]";
}

function parseCachedUser(parsed: Record<string, unknown>): AuthUser | null {
  const userId = String(parsed.userId ?? "");
  const email = String(parsed.email ?? "");
  const fullName = String(parsed.fullName ?? "");
  if (userId.length === 0 || email.length === 0 || fullName.length === 0) {
    return null;
  }
  return {
    userId,
    orgId: String(parsed.orgId ?? ""),
    role: String(parsed.role ?? "analyst"),
    isSuperUser: parsed.isSuperUser === true,
    email,
    fullName,
  };
}

export function getAccountDisplayCacheRaw(): string | null {
  if (!hasLocalStorage()) {
    return null;
  }
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseAccountDisplayCacheRaw(raw: string | null): AuthUser | null {
  if (raw === null || raw === "") {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    return parseCachedUser(parsed);
  } catch {
    return null;
  }
}

/** Last known profile for sidebar/footer shells (offline-first paint). */
export function readAccountDisplayCache(): AuthUser | null {
  return parseAccountDisplayCacheRaw(getAccountDisplayCacheRaw());
}

export function writeAccountDisplayCache(user: AuthUser): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    notifyCacheListeners();
  } catch {
    // ignore quota / private mode
  }
}

export function clearAccountDisplayCache(): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY);
    notifyCacheListeners();
  } catch {
    // ignore
  }
}
