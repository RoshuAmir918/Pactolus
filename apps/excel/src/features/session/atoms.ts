import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
  ChatMessage,
  ClientOption,
  MonitoredRegion,
  OperationRecord,
  RunOption,
  RunSession,
  SnapshotOption,
  SourceDocument,
  UiPage,
} from "@/features/types";
import { emptyRunSession } from "@/features/operations/actions";

// ── persisted across task pane close ─────────────────────────────────────────

export const apiUrlAtom = atomWithStorage<string>("pactolus:apiUrl", "https://localhost:3001");
export const webUrlAtom = atomWithStorage<string>("pactolus:webUrl", "http://localhost:3000");
export const selectedClientIdAtom = atomWithStorage<string>("pactolus:selectedClientId", "");
export const snapshotIdAtom = atomWithStorage<string>("pactolus:snapshotId", "");
export const runModeAtom = atomWithStorage<"create" | "select">("pactolus:runMode", "create");
export const selectedRunIdAtom = atomWithStorage<string>("pactolus:selectedRunId", "");
export const runSessionAtom = atomWithStorage<RunSession>("pactolus:runSession", emptyRunSession());

// ── ephemeral (reset on page load) ────────────────────────────────────────────

export const currentPageAtom = atom<UiPage>("auth");
export const officeReadyAtom = atom<boolean>(false);
export const authenticatedAtom = atom<boolean>(false);
export const authEmailAtom = atom<string | null>(null);
export const authFullNameAtom = atom<string | null>(null);
export const statusAtom = atom<{ kind: "ok" | "error"; message: string } | null>(null);
export const isBusyAtom = atom<boolean>(false);

export const detectedRegionsAtom = atom<MonitoredRegion[]>([]);

export const availableClientsAtom = atom<ClientOption[]>([]);
export const allSnapshotsAtom = atom<SnapshotOption[]>([]);
export const availableRunsAtom = atom<RunOption[]>([]);
export const committedOperationsAtom = atom<OperationRecord[]>([]);
export const sourceDocumentsAtom = atom<SourceDocument[]>([]);
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
  return `Run: ${session.runId ?? "none"} | Op: ${session.currentOperationId?.slice(0, 8) ?? "none"}`;
});
