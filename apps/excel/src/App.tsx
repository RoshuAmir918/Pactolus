import { useEffect, useMemo, useState } from "react";
import { AuthPage } from "@/pages-react/AuthPage";
import { RunSetupPage } from "@/pages-react/RunSetupPage";
import { WorkspacePage } from "@/pages-react/WorkspacePage";
import { getApiClient, normalizeApiUrl, testApiConnection } from "@/lib/api/client";
import {
  appendRunStepIfActive,
  isSelectedBranchActive,
  toBranchOptions,
  toRunOptions,
} from "@/features/operations/actions";
import { useExcelSessionState } from "@/features/session/store";
import type { ClientOption, RunSession, SnapshotOption } from "@/features/types";

export default function App() {
  const state = useExcelSessionState();
  const [apiUrl, setApiUrl] = useState("https://localhost:3001");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [availableClients, setAvailableClients] = useState<ClientOption[]>([]);
  const [allSnapshots, setAllSnapshots] = useState<SnapshotOption[]>([]);
  const [runMode, setRunMode] = useState<"create" | "select">("create");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");

  useEffect(() => {
    if (!("Office" in window)) {
      setError("Office.js is unavailable. Open this via Excel add-in sideload.");
      return;
    }
    Office.onReady((info) => {
      if (info.host !== Office.HostType.Excel) {
        setError("This add-in currently supports only Excel.");
        return;
      }
      state.setOfficeReady(true);
      setOk("Connected to Excel.");
    });
  }, []);

  function setOk(message: string) {
    state.setStatus({ kind: "ok", message });
  }

  function setError(message: string) {
    state.setStatus({ kind: "error", message });
  }

  function mergeRunSession(values: Partial<RunSession>) {
    state.setRunSession((prev) => ({
      ...prev,
      ...values,
    }));
  }

  const normalizedApiUrl = useMemo(() => normalizeApiUrl(apiUrl), [apiUrl]);
  const availableSnapshots = useMemo(
    () => allSnapshots.filter((snapshot) => snapshot.clientId === selectedClientId),
    [allSnapshots, selectedClientId],
  );

  async function loadClientAndSnapshotOptions() {
    if (!normalizedApiUrl) {
      return;
    }
    try {
      const client = getApiClient(normalizedApiUrl);
      const [clients, snapshots] = await Promise.all([
        client.organizations.myClients.query(),
        client.organizations.mySnapshots.query(),
      ]);
      setAvailableClients(
        (clients as Array<{ id: string; name: string; status: string }>).map((item) => ({
          id: item.id,
          name: item.name,
          status: item.status,
        })),
      );
      setAllSnapshots(
        (
          snapshots as Array<{
            id: string;
            clientId: string;
            label: string;
            status: string;
            accountingPeriod: string | null;
          }>
        ).map((snapshot) => ({
          id: snapshot.id,
          clientId: snapshot.clientId,
          label: snapshot.label,
          status: snapshot.status,
          accountingPeriod: snapshot.accountingPeriod ?? null,
        })),
      );
      if (clients.length === 0) {
        setOk("No clients found for your organization.");
      }
    } catch (error) {
      setError(`Failed loading clients/snapshots: ${formatError(error)}`);
    }
  }

  async function onTestConnection() {
    if (!normalizedApiUrl) {
      setError("Enter API URL.");
      return;
    }
    state.setIsBusy(true);
    try {
      const result = await testApiConnection(normalizedApiUrl);
      if (!result.healthOk) {
        setError("API health check failed.");
        return;
      }
      setOk(
        result.hasSession
          ? "Connection OK. Existing authenticated session detected."
          : "Connection OK. No existing session yet (login required).",
      );
    } catch (error) {
      setError(`Connection test failed: ${formatError(error)}`);
    } finally {
      state.setIsBusy(false);
    }
  }

  async function onLogin() {
    if (state.authenticated) {
      setOk("Already authenticated. Use Logout to switch account.");
      return;
    }
    if (!normalizedApiUrl || !email.trim() || !password) {
      setError("Enter API URL, email, and password.");
      return;
    }
    state.setIsBusy(true);
    setOk("Logging in... please wait.");
    try {
      const client = getApiClient(normalizedApiUrl);
      await client.auth.login.mutate({ email: email.trim(), password });
      await client.auth.me.query();
      state.setAuthenticated(true);
      state.setAuthEmail(email.trim());
      await loadClientAndSnapshotOptions();
      state.setCurrentPage("run");
      setOk("Authenticated with Pactolus API.");
    } catch (error) {
      state.setAuthenticated(false);
      state.setAuthEmail(null);
      setError(`Login failed: ${formatError(error)}`);
    } finally {
      state.setIsBusy(false);
    }
  }

  async function onLogout() {
    state.setAuthenticated(false);
    state.setAuthEmail(null);
    state.setRunSession({
      runId: null,
      branchId: null,
      lastStepId: null,
      startedAtIso: null,
    });
    state.setAvailableRuns([]);
    state.setAvailableBranches([]);
    state.setBranchSummaryText("No branch summary yet.");
    setAvailableClients([]);
    setAllSnapshots([]);
    setSelectedClientId("");
    setSnapshotId("");
    state.setCurrentPage("auth");
    setOk("Logged out in add-in session.");
  }

  async function onLoadRuns() {
    if (!state.authenticated) {
      setError("Login first.");
      return;
    }
    if (!selectedClientId) {
      setError("Select a client first.");
      return;
    }
    if (!snapshotId.trim()) {
      setError("Enter a snapshot ID before loading runs.");
      return;
    }
    try {
      const client = getApiClient(normalizedApiUrl);
      const result = await client.operations.getRunsBySnapshot.query({
        snapshotId: snapshotId.trim(),
        limit: 25,
      });
      state.setAvailableRuns(toRunOptions(result.runs));
      state.setAvailableBranches([]);
      setSelectedRunId("");
      setSelectedBranchId("");
      mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
      setOk(`Loaded ${result.runs.length} run(s). Select a run to load branches.`);
    } catch (error) {
      setError(`Load runs failed: ${formatError(error)}`);
    }
  }

  function onSelectClient(clientId: string) {
    setSelectedClientId(clientId);
    setSnapshotId("");
    state.setAvailableRuns([]);
    state.setAvailableBranches([]);
    setSelectedRunId("");
    setSelectedBranchId("");
    mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
  }

  async function onSelectRun(runId: string) {
    setSelectedRunId(runId);
    if (!runId) {
      state.setAvailableBranches([]);
      setSelectedBranchId("");
      mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
      return;
    }
    try {
      const client = getApiClient(normalizedApiUrl);
      const result = await client.operations.getRunBranches.query({ runId });
      state.setAvailableBranches(toBranchOptions(result.branches));
      mergeRunSession({ runId, branchId: null, lastStepId: null, startedAtIso: null });
      setSelectedBranchId("");
      setOk(`Loaded ${result.branches.length} branch(es). Select one to continue.`);
    } catch (error) {
      setError(`Load branches failed: ${formatError(error)}`);
    }
  }

  function onSelectBranch(branchId: string) {
    setSelectedBranchId(branchId);
    mergeRunSession({
      runId: selectedRunId || null,
      branchId: branchId || null,
      lastStepId: null,
      startedAtIso: branchId ? new Date().toISOString() : null,
    });
    if (branchId) {
      setOk("Run and branch selected for this Excel session.");
    }
  }

  function onSelectBranchFromWorkspace(branchId: string) {
    setSelectedBranchId(branchId);
    mergeRunSession({
      runId: state.runSession.runId,
      branchId,
      lastStepId: null,
      startedAtIso: new Date().toISOString(),
    });
    setOk("Active branch changed.");
  }

  async function onDeleteBranch(branchId: string) {
    if (!state.runSession.runId) {
      setError("No active run.");
      return;
    }
    try {
      const client = getApiClient(normalizedApiUrl);
      await client.operations.archiveBranch.mutate({
        runId: state.runSession.runId,
        branchId,
      });
      const branchesResult = await client.operations.getRunBranches.query({
        runId: state.runSession.runId,
      });
      const refreshed = toBranchOptions(branchesResult.branches);
      state.setAvailableBranches(refreshed);

      if (state.runSession.branchId === branchId) {
        const fallback =
          refreshed.find((branch) => branch.status === "active") ?? refreshed[0] ?? null;
        setSelectedBranchId(fallback?.id ?? "");
        mergeRunSession({
          branchId: fallback?.id ?? null,
          lastStepId: null,
        });
      }
      setOk("Branch deleted.");
    } catch (error) {
      if (isMissingProcedureError(error, "operations.archiveBranch")) {
        setError(
          'Delete branch failed because the API is on an older build. Restart API with "npm run api:dev" from repo root, then retry.',
        );
        return;
      }
      setError(`Delete branch failed: ${formatError(error)}`);
    }
  }

  async function onContinueFromRunSetup() {
    if (!snapshotId.trim()) {
      setError("Select a snapshot ID before continuing.");
      return;
    }

    const client = getApiClient(normalizedApiUrl);

    if (runMode === "create") {
      try {
        const runResult = await client.operations.createRun.mutate({
          snapshotId: snapshotId.trim(),
          name: "Excel run",
        });
        setSelectedRunId(runResult.runId);
        setSelectedBranchId(runResult.mainBranchId);
        mergeRunSession({
          runId: runResult.runId,
          branchId: runResult.mainBranchId,
          lastStepId: null,
          startedAtIso: new Date().toISOString(),
        });
        setOk("Run created. Continue in workspace.");
      } catch (error) {
        setError(`Create run failed: ${formatError(error)}`);
        return;
      }
    } else if (!state.runSession.runId || !state.runSession.branchId) {
      setError("Select an existing run and branch before continuing.");
      return;
    }

    state.setCurrentPage("workspace");
  }

  async function onForkBranch() {
    if (!state.runSession.runId || !state.runSession.branchId) {
      setError("Select a run and branch before forking.");
      return;
    }
    const branchName = `branch-${Date.now()}`;
    const client = getApiClient(normalizedApiUrl);
    try {
      const created = await client.operations.createBranch.mutate({
        runId: state.runSession.runId,
        name: branchName,
        parentBranchId: state.runSession.branchId,
        forkedFromStepId: state.runSession.lastStepId ?? undefined,
      });
      const forkStepId = await appendRunStepIfActive({
        client,
        runSession: state.runSession,
        runId: state.runSession.runId,
        branchId: created.branchId,
        stepType: "branch_forked",
        idempotencyKey: `branch-forked:${created.branchId}:${state.runSession.lastStepId ?? "root"}`,
        parametersJson: {
          parentBranchId: state.runSession.branchId,
          newBranchId: created.branchId,
          branchName,
          forkedFromStepId: state.runSession.lastStepId ?? null,
        },
      });
      const branchesResult = await client.operations.getRunBranches.query({
        runId: state.runSession.runId,
      });
      state.setAvailableBranches(toBranchOptions(branchesResult.branches));
      setSelectedBranchId(created.branchId);
      mergeRunSession({
        branchId: created.branchId,
        lastStepId: forkStepId ?? null,
        startedAtIso: new Date().toISOString(),
      });
      setOk(`Forked new branch "${branchName}".`);
    } catch (error) {
      setError(`Fork branch failed: ${formatError(error)}`);
    }
  }

  async function onCompleteBranch() {
    if (!state.runSession.runId || !state.runSession.branchId) {
      setError("Select a run and branch before completing.");
      return;
    }
    try {
      const client = getApiClient(normalizedApiUrl);
      const result = await client.operations.completeBranch.mutate({
        runId: state.runSession.runId,
        branchId: state.runSession.branchId,
        idempotencyKey: `branch-complete:${state.runSession.branchId}`,
        generateAiSummary: true,
      });
      const branchesResult = await client.operations.getRunBranches.query({
        runId: state.runSession.runId,
      });
      state.setAvailableBranches(toBranchOptions(branchesResult.branches));
      mergeRunSession({ lastStepId: result.completionStepId });
      setOk("Branch completed.");
    } catch (error) {
      setError(`Complete branch failed: ${formatError(error)}`);
    }
  }

  const canContinueToWorkspace =
    Boolean(selectedClientId && snapshotId.trim()) &&
    (runMode === "create" || Boolean(state.runSession.runId && state.runSession.branchId));
  const canActiveBranch = isSelectedBranchActive(state.runSession, state.availableBranches);

  if (state.currentPage === "auth") {
    return (
      <AuthPage
        apiUrl={apiUrl}
        email={email}
        password={password}
        authSummary={state.authSummary}
        status={state.status}
        loggingIn={state.isBusy}
        canLogout={state.authenticated}
        onApiUrlChange={setApiUrl}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onLogin={onLogin}
        onLogout={onLogout}
        onTestConnection={onTestConnection}
      />
    );
  }

  if (state.currentPage === "run") {
    return (
      <RunSetupPage
        snapshotId={snapshotId}
        selectedClientId={selectedClientId}
        runMode={runMode}
        runSummary={state.runSummary}
        availableClients={availableClients}
        availableSnapshots={availableSnapshots}
        availableRuns={state.availableRuns}
        availableBranches={state.availableBranches}
        selectedRunId={selectedRunId}
        selectedBranchId={selectedBranchId}
        status={state.status}
        canContinue={canContinueToWorkspace}
        onReloadContext={loadClientAndSnapshotOptions}
        onClientSelect={onSelectClient}
        onSnapshotIdChange={(value) => {
          setSnapshotId(value);
          state.setAvailableRuns([]);
          state.setAvailableBranches([]);
          setSelectedRunId("");
          setSelectedBranchId("");
          mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
        }}
        onRunModeChange={(value) => {
          setRunMode(value);
          state.setRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
          state.setAvailableRuns([]);
          state.setAvailableBranches([]);
          setSelectedRunId("");
          setSelectedBranchId("");
        }}
        onLoadRuns={onLoadRuns}
        onRunSelect={onSelectRun}
        onBranchSelect={onSelectBranch}
        onContinue={onContinueFromRunSetup}
      />
    );
  }

  return (
    <WorkspacePage
      runSession={state.runSession}
      availableBranches={state.availableBranches}
      status={state.status}
      canFork={Boolean(state.runSession.runId && state.runSession.branchId)}
      canCompleteBranch={Boolean(state.runSession.runId && state.runSession.branchId && canActiveBranch)}
      onBackToRun={() => state.setCurrentPage("run")}
      onSelectBranch={onSelectBranchFromWorkspace}
      onDeleteBranch={onDeleteBranch}
      onForkBranch={onForkBranch}
      onCompleteBranch={onCompleteBranch}
    />
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return "Failed to reach API. Check API URL, API server status, and CORS origin.";
    }
    return error.message;
  }
  return String(error);
}

function isMissingProcedureError(error: unknown, path: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("No procedure found on path") && error.message.includes(path)
  );
}
