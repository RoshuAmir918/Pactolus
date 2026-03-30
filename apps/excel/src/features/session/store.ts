import { useMemo, useState } from "react";
import type {
  BranchOption,
  MonitoredRegion,
  RunOption,
  RunSession,
  Snapshot,
  Suggestion,
  UiPage,
} from "@/features/types";
import { emptyRunSession } from "@/features/operations/actions";

export function useExcelSessionState() {
  const [currentPage, setCurrentPage] = useState<UiPage>("auth");
  const [officeReady, setOfficeReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [latestSnapshot, setLatestSnapshot] = useState<Snapshot | null>(null);
  const [latestSuggestion, setLatestSuggestion] = useState<Suggestion | null>(null);
  const [detectedRegions, setDetectedRegions] = useState<MonitoredRegion[]>([]);
  const [monitoredRegions, setMonitoredRegions] = useState<MonitoredRegion[]>([]);
  const [runSession, setRunSession] = useState<RunSession>(emptyRunSession());
  const [availableRuns, setAvailableRuns] = useState<RunOption[]>([]);
  const [availableBranches, setAvailableBranches] = useState<BranchOption[]>([]);
  const [branchSummaryText, setBranchSummaryText] = useState("No branch summary yet.");

  const authSummary = useMemo(() => {
    return authenticated && authEmail ? `Authenticated as ${authEmail}.` : "Not authenticated.";
  }, [authenticated, authEmail]);

  const runSummary = useMemo(() => {
    return `Run: ${runSession.runId ?? "none"} | Branch: ${runSession.branchId ?? "none"}`;
  }, [runSession.branchId, runSession.runId]);

  return {
    currentPage,
    setCurrentPage,
    officeReady,
    setOfficeReady,
    authenticated,
    setAuthenticated,
    authEmail,
    setAuthEmail,
    status,
    setStatus,
    isBusy,
    setIsBusy,
    latestSnapshot,
    setLatestSnapshot,
    latestSuggestion,
    setLatestSuggestion,
    detectedRegions,
    setDetectedRegions,
    monitoredRegions,
    setMonitoredRegions,
    runSession,
    setRunSession,
    availableRuns,
    setAvailableRuns,
    availableBranches,
    setAvailableBranches,
    branchSummaryText,
    setBranchSummaryText,
    authSummary,
    runSummary,
  };
}
