import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
  BranchOption,
  ChatMessage,
  ClientOption,
  MonitoredRegion,
  RunOption,
  RunSession,
  Snapshot,
  SnapshotOption,
  SourceDocument,
  StepRecord,
  Suggestion,
  UiPage,
} from "@/features/types";
import { emptyRunSession } from "@/features/operations/actions";

// ── persisted across task pane close ─────────────────────────────────────────

export const apiUrlAtom = atomWithStorage<string>(
  "pactolus:apiUrl",
  "https://localhost:3001",
);

export const selectedClientIdAtom = atomWithStorage<string>(
  "pactolus:selectedClientId",
  "",
);

export const snapshotIdAtom = atomWithStorage<string>(
  "pactolus:snapshotId",
  "",
);

export const runModeAtom = atomWithStorage<"create" | "select">(
  "pactolus:runMode",
  "create",
);

export const selectedRunIdAtom = atomWithStorage<string>(
  "pactolus:selectedRunId",
  "",
);

export const selectedBranchIdAtom = atomWithStorage<string>(
  "pactolus:selectedBranchId",
  "",
);

export const runSessionAtom = atomWithStorage<RunSession>(
  "pactolus:runSession",
  emptyRunSession(),
);

// ── ephemeral (reset on page load) ────────────────────────────────────────────

export const currentPageAtom = atom<UiPage>("auth");
export const officeReadyAtom = atom<boolean>(false);
export const authenticatedAtom = atom<boolean>(false);
export const authEmailAtom = atom<string | null>(null);
export const statusAtom = atom<{ kind: "ok" | "error"; message: string } | null>(null);
export const isBusyAtom = atom<boolean>(false);

export const latestSnapshotAtom = atom<Snapshot | null>(null);
export const latestSuggestionAtom = atom<Suggestion | null>(null);
export const detectedRegionsAtom = atom<MonitoredRegion[]>([]);
export const monitoredRegionsAtom = atom<MonitoredRegion[]>([]);

export const availableClientsAtom = atom<ClientOption[]>([]);
export const allSnapshotsAtom = atom<SnapshotOption[]>([]);
export const availableRunsAtom = atom<RunOption[]>([]);
export const availableBranchesAtom = atom<BranchOption[]>([]);
export const committedOperationsAtom = atom<StepRecord[]>([]);
export const sourceDocumentsAtom = atom<SourceDocument[]>([]);
export const detectingRegionsAtom = atom<boolean>(false);
export const branchSummaryTextAtom = atom<string>("No branch summary yet.");
export const chatMessagesAtom = atom<ChatMessage[]>([]);

// ── derived ───────────────────────────────────────────────────────────────────

export const availableSnapshotsAtom = atom((get) =>
  get(allSnapshotsAtom).filter((s) => s.clientId === get(selectedClientIdAtom)),
);

export const authSummaryAtom = atom((get) => {
  const authenticated = get(authenticatedAtom);
  const email = get(authEmailAtom);
  return authenticated && email ? `Authenticated as ${email}.` : "Not authenticated.";
});

export const runSummaryAtom = atom((get) => {
  const session = get(runSessionAtom);
  return `Run: ${session.runId ?? "none"} | Branch: ${session.branchId ?? "none"}`;
});
