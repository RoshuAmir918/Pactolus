import { trpc } from "@/lib/trpc-client";
import type { AuthUser } from "@/lib/trpc";

export type { AuthUser };

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await trpc.auth.login.mutate({ email, password });
  return result.user;
}

export async function logout(): Promise<void> {
  await trpc.auth.logout.mutate();
}

export async function getMe(): Promise<AuthUser | null> {
  return trpc.auth.me.query();
}
