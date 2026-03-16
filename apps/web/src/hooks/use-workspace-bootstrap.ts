"use client";

import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  loadWorkspaceAtom,
  workspaceLoadStatusAtom,
} from "@/stores/workspace";

export function useWorkspaceBootstrap() {
  const status = useAtomValue(workspaceLoadStatusAtom);
  const loadWorkspace = useSetAtom(loadWorkspaceAtom);

  useEffect(() => {
    if (status === "idle") {
      void loadWorkspace();
    }
  }, [status, loadWorkspace]);
}
