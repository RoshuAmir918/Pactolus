"use client";

import { atom } from "jotai";

export type LeftPaneMode = "clients" | "snapshot";

export const leftPaneModeAtom = atom<LeftPaneMode>("clients");
export const activeClientIdAtom = atom<string | null>(null);
export const activeSnapshotIdAtom = atom<string | null>(null);
