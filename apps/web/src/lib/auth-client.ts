import {
  clearAccountDisplayCache,
  writeAccountDisplayCache,
} from "@/lib/account-display-cache";
import { trpc } from "@/lib/trpc-client";
import type { AuthUser } from "@/lib/trpc";

export type { AuthUser };

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await trpc.auth.login.mutate({ email, password });
  writeAccountDisplayCache(result.user);
  return result.user;
}

export async function logout(): Promise<void> {
  await trpc.auth.logout.mutate();
  clearAccountDisplayCache();
}

export async function getMe(): Promise<AuthUser | null> {
  const me = await trpc.auth.me.query();
  if (me) {
    writeAccountDisplayCache(me);
  } else {
    clearAccountDisplayCache();
  }
  return me;
}
