"use client";

import { atom } from "jotai";
import type { AuthUser } from "@/lib/auth-client";

export const authUserAtom = atom<AuthUser | null>(null);

/** True when the user is signed in and their membership role is `admin`. */
export const isLoggedInAdminAtom = atom((get) => {
  const user = get(authUserAtom);
  return user !== null && user.role === "admin";
});
