"use client";

import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  loadWorkspaceAtom,
  workspaceLoadStatusAtom,
} from "@/stores/workspace";
import {
  activeViewAtom,
  activeClientIdAtom,
  activeDocumentIdAtom,
  activeSnapshotIdAtom,
  leftPaneModeAtom,
} from "@/stores/workspace-ui";

export function useWorkspaceBootstrap() {
  const status = useAtomValue(workspaceLoadStatusAtom);
  const loadWorkspace = useSetAtom(loadWorkspaceAtom);
  const setActiveView = useSetAtom(activeViewAtom);
  const setActiveClientId = useSetAtom(activeClientIdAtom);
  const setActiveDocumentId = useSetAtom(activeDocumentIdAtom);
  const setActiveSnapshotId = useSetAtom(activeSnapshotIdAtom);
  const setLeftPaneMode = useSetAtom(leftPaneModeAtom);

  useEffect(() => {
    if (status === "idle") {
      void loadWorkspace();
    }
  }, [status, loadWorkspace]);

  // Deep-link: /workspace?clientId=&snapshotId=&runId=&nodeId=  (or &documentId=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");
    const snapshotId = params.get("snapshotId");
    const runId = params.get("runId");
    const nodeId = params.get("nodeId");
    const documentId = params.get("documentId");

    if (documentId && snapshotId && clientId) {
      setActiveDocumentId(documentId);
      setActiveClientId(clientId);
      setActiveSnapshotId(snapshotId);
      setLeftPaneMode("snapshot");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (runId && clientId && snapshotId) {
      if (nodeId) {
        setActiveView({ type: "node", clientId, snapshotId, runId, nodeId });
      } else {
        setActiveView({ type: "run", clientId, snapshotId, runId });
      }
      setActiveClientId(clientId);
      setActiveSnapshotId(snapshotId);
      setLeftPaneMode("snapshot");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setActiveView, setActiveClientId, setActiveDocumentId, setActiveSnapshotId, setLeftPaneMode]);
}
