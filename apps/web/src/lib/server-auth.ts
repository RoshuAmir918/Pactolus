import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/trpc";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || value === undefined) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value: unknown): value is string {
  return value != null && String(value) === value && (value as string).length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return value === true || value === false;
}

function parseAuthUser(data: unknown): AuthUser | null {
  if (!isPlainObject(data)) return null;
  const { userId, orgId, role, isSuperUser } = data;
  if (
    !isNonEmptyString(userId) ||
    !isNonEmptyString(orgId) ||
    !isNonEmptyString(role) ||
    !isBoolean(isSuperUser)
  ) {
    return null;
  }
  return { userId, orgId, role, isSuperUser };
}

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_INTERNAL_URL ??
  "http://127.0.0.1:4000";

/** Same session as client `auth.me`, for use in Server Components / layouts. */
export async function getMeOnServer(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookieHeader) return null;

  const input = encodeURIComponent(JSON.stringify({ 0: { json: null } }));
  const url = `${getApiUrl()}/trpc/auth.me?batch=1&input=${input}`;

  const res = await fetch(url, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;

  const item = json[0] as { error?: unknown; result?: { data?: unknown } };
  if (item.error) return null;

  return parseAuthUser(item.result?.data);
}
