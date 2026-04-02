"use client";

import { atom } from "jotai";

export type ActiveView =
  | { type: "home" }
  | { type: "snapshot"; snapshotId: string; clientId: string }
  | { type: "run"; snapshotId: string; clientId: string; runId: string }
  | { type: "node"; snapshotId: string; clientId: string; runId: string; nodeId: string };

export const activeViewAtom = atom<ActiveView>({ type: "home" });
export const activeClientIdAtom = atom<string | null>(null);
export const activeSnapshotIdAtom = atom<string | null>(null);
export const activeRunIdAtom = atom<string | null>(null);
export const activeNodeIdAtom = atom<string | null>(null);

export const rightPanelOpenAtom = atom<boolean>(true);
export const bottomPanelOpenAtom = atom<boolean>(true);

// Which snapshots are expanded in the sidebar
export const expandedClientIdsAtom = atom<Set<string>>(new Set<string>());
export const expandedSnapshotIdsAtom = atom<Set<string>>(new Set<string>());

// Compatibility stub — kept so old sidebar files compile
export type LeftPaneMode = "clients" | "snapshot";
export const leftPaneModeAtom = atom<LeftPaneMode>("clients");
