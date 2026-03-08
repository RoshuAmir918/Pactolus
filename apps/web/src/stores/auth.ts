"use client";

import { atom } from "jotai";
import type { AuthUser } from "@/lib/auth-client";

export const authUserAtom = atom<AuthUser | null>(null);
