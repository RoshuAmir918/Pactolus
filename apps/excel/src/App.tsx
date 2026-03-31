import { useEffect, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { AuthPage } from "@/pages-react/AuthPage";
import { RunSetupPage } from "@/pages-react/RunSetupPage";
import { WorkspacePage } from "@/pages-react/workspace";
import { getApiClient, normalizeApiUrl, testApiConnection } from "@/lib/api/client";
import {
  appendRunStepIfActive,
  toBranchOptions,
  toRunOptions,
} from "@/features/operations/actions";
import {
  apiUrlAtom,
  authenticatedAtom,
  authEmailAtom,
  authSummaryAtom,
  availableBranchesAtom,
  availableClientsAtom,
  availableRunsAtom,
  availableSnapshotsAtom,
  allSnapshotsAtom,
  chatMessagesAtom,
  committedOperationsAtom,
  currentPageAtom,
  detectedRegionsAtom,
  sourceDocumentsAtom,
  isBusyAtom,
  officeReadyAtom,
  runModeAtom,
  runSessionAtom,
  runSummaryAtom,
  selectedBranchIdAtom,
  selectedClientIdAtom,
  selectedRunIdAtom,
  snapshotIdAtom,
  statusAtom,
} from "@/features/session/atoms";
import { getWorkbookBlob, captureAllSheetSlices, selectRange, WORKBOOK_CONTENT_TYPE } from "@/lib/office/worksheet";
import { getCachedDownloadUrl, setCachedDownloadUrl } from "@/lib/api/downloadCache";
import type { RunSession, StepRecord } from "@/features/types";

export default function App() {
  // ── persisted atoms ──────────────────────────────────────────────────────────
  const [apiUrl, setApiUrl] = useAtom(apiUrlAtom);
  const [selectedClientId, setSelectedClientId] = useAtom(selectedClientIdAtom);
  const [snapshotId, setSnapshotId] = useAtom(snapshotIdAtom);
  const [runMode, setRunMode] = useAtom(runModeAtom);
  const [selectedRunId, setSelectedRunId] = useAtom(selectedRunIdAtom);
  const [selectedBranchId, setSelectedBranchId] = useAtom(selectedBranchIdAtom);
  const [runSession, setRunSession] = useAtom(runSessionAtom);

  // ── ephemeral atoms ──────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  const [, setOfficeReady] = useAtom(officeReadyAtom);
  const [authenticated, setAuthenticated] = useAtom(authenticatedAtom);
  const [, setAuthEmail] = useAtom(authEmailAtom);
  const [status, setStatus] = useAtom(statusAtom);
  const [isBusy, setIsBusy] = useAtom(isBusyAtom);
  const [availableClients, setAvailableClients] = useAtom(availableClientsAtom);
  const [, setAllSnapshots] = useAtom(allSnapshotsAtom);
  const [availableRuns, setAvailableRuns] = useAtom(availableRunsAtom);
  const [availableBranches, setAvailableBranches] = useAtom(availableBranchesAtom);
  const [committedOperations, setCommittedOperations] = useAtom(committedOperationsAtom);
  const [sourceDocuments, setSourceDocuments] = useAtom(sourceDocumentsAtom);
  const [detectedRegions, setDetectedRegions] = useAtom(detectedRegionsAtom);
  const [, setChatMessages] = useAtom(chatMessagesAtom);

  // ── derived atoms ────────────────────────────────────────────────────────────
  const availableSnapshots = useAtomValue(availableSnapshotsAtom);
  const authSummary = useAtomValue(authSummaryAtom);
  const runSummary = useAtomValue(runSummaryAtom);

  // ── local ui-only state (no persistence needed) ───────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const normalizedApiUrl = normalizeApiUrl(apiUrl);

  // ── helpers ──────────────────────────────────────────────────────────────────

  function setOk(message: string) {
    setStatus({ kind: "ok", message });
  }

  function setError(message: string) {
    setStatus({ kind: "error", message });
  }

  function mergeRunSession(values: Partial<RunSession>) {
    setRunSession((prev) => ({ ...prev, ...values }));
  }

  // ── boot ──────────────────────────────────────────────────────────────────────

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
      setOfficeReady(true);
      setOk("Connected to Excel.");
    });
  }, []);

  // ── api helpers ───────────────────────────────────────────────────────────────

  async function loadClientAndSnapshotOptions() {
    if (!normalizedApiUrl) return;
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

  // ── auth ──────────────────────────────────────────────────────────────────────

  async function onTestConnection() {
    if (!normalizedApiUrl) {
      setError("Enter API URL.");
      return;
    }
    setIsBusy(true);
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
      setIsBusy(false);
    }
  }

  async function onLogin() {
    if (authenticated) {
      setOk("Already authenticated. Use Logout to switch account.");
      return;
    }
    if (!normalizedApiUrl || !email.trim() || !password) {
      setError("Enter API URL, email, and password.");
      return;
    }
    setIsBusy(true);
    setOk("Logging in... please wait.");
    try {
      const client = getApiClient(normalizedApiUrl);
      await client.auth.login.mutate({ email: email.trim(), password });
      await client.auth.me.query();
      setAuthenticated(true);
      setAuthEmail(email.trim());
      await loadClientAndSnapshotOptions();
      // restore persisted snapshot/run/branch selection
      if (snapshotId) {
        await fetchRuns(snapshotId);
        if (selectedRunId) {
          await fetchBranches(selectedRunId);
        }
      }
      setCurrentPage("run");
      setOk("Authenticated with Pactolus API.");
    } catch (error) {
      setAuthenticated(false);
      setAuthEmail(null);
      setError(`Login failed: ${formatError(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function onLogout() {
    setAuthenticated(false);
    setAuthEmail(null);
    setRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
    setAvailableRuns([]);
    setAvailableBranches([]);
    setAvailableClients([]);
    setAllSnapshots([]);
    setSelectedClientId("");
    setSnapshotId("");
    setSelectedRunId("");
    setSelectedBranchId("");
    setCurrentPage("auth");
    setOk("Logged out in add-in session.");
  }

  // ── run setup ─────────────────────────────────────────────────────────────────

  async function fetchRuns(resolvedSnapshotId: string) {
    const client = getApiClient(normalizedApiUrl);
    const result = await client.operations.getRunsBySnapshot.query({
      snapshotId: resolvedSnapshotId.trim(),
      limit: 25,
    });
    setAvailableRuns(toRunOptions(result.runs));
    return result.runs;
  }

  async function fetchBranches(runId: string) {
    const client = getApiClient(normalizedApiUrl);
    const result = await client.operations.getRunBranches.query({ runId });
    const options = toBranchOptions(result.branches);
    setAvailableBranches(options);
    // auto-select the first active branch — no manual branch picking needed
    const auto = options.find((b) => b.status === "active") ?? options[0];
    if (auto) {
      setSelectedBranchId(auto.id);
      mergeRunSession({ runId, branchId: auto.id, lastStepId: null, startedAtIso: null });
    }
    return result.branches;
  }

  async function onLoadRuns(snapshotIdOverride?: string) {
    if (!authenticated) {
      setError("Login first.");
      return;
    }
    if (!selectedClientId) {
      setError("Select a client first.");
      return;
    }
    const resolvedSnapshotId = snapshotIdOverride ?? snapshotId;
    if (!resolvedSnapshotId.trim()) {
      setError("Enter a snapshot ID before loading runs.");
      return;
    }
    try {
      const runs = await fetchRuns(resolvedSnapshotId);
      setAvailableBranches([]);
      setSelectedRunId("");
      setSelectedBranchId("");
      mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
      setOk(`Loaded ${runs.length} run(s). Select a run to load branches.`);
    } catch (error) {
      setError(`Load runs failed: ${formatError(error)}`);
    }
  }

  function onSelectClient(clientId: string) {
    setSelectedClientId(clientId);
    setSnapshotId("");
    setAvailableRuns([]);
    setAvailableBranches([]);
    setSelectedRunId("");
    setSelectedBranchId("");
    mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
  }

  async function onSelectRun(runId: string) {
    setSelectedRunId(runId);
    if (!runId) {
      setAvailableBranches([]);
      setSelectedBranchId("");
      mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
      return;
    }
    try {
      await fetchBranches(runId);
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

  async function onSelectBranchFromWorkspace(branchId: string) {
    setSelectedBranchId(branchId);
    mergeRunSession({
      runId: runSession.runId,
      branchId,
      lastStepId: null,
      startedAtIso: new Date().toISOString(),
    });
    setOk("Active branch changed.");
    await onLoadCommittedOperations(runSession.runId ?? undefined, branchId);
  }

  async function onDeleteBranch(branchId: string) {
    if (!runSession.runId) {
      setError("No active run.");
      return;
    }
    try {
      const client = getApiClient(normalizedApiUrl);
      await client.operations.archiveBranch.mutate({
        runId: runSession.runId,
        branchId,
      });
      const branchesResult = await client.operations.getRunBranches.query({
        runId: runSession.runId,
      });
      const refreshed = toBranchOptions(branchesResult.branches);
      setAvailableBranches(refreshed);

      if (runSession.branchId === branchId) {
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
          name: "Analysis",
        });
        setSelectedRunId(runResult.runId);
        setSelectedBranchId(runResult.mainBranchId);
        mergeRunSession({
          runId: runResult.runId,
          branchId: runResult.mainBranchId,
          lastStepId: null,
          startedAtIso: new Date().toISOString(),
        });
        await onLoadCommittedOperations(runResult.runId, runResult.mainBranchId);
        setOk("Run created. Continue in workspace.");
      } catch (error) {
        setError(`Create run failed: ${formatError(error)}`);
        return;
      }
    } else if (!runSession.runId || !runSession.branchId) {
      setError("Select an existing run and branch before continuing.");
      return;
    } else {
      await onLoadCommittedOperations(runSession.runId, runSession.branchId);
    }

    // Load source documents for the workspace doc strip
    try {
      const docs = await client.storage.getSourceDocuments.query({ snapshotId: snapshotId.trim() });
      setSourceDocuments(docs.documents);
    } catch {
      setSourceDocuments([]);
    }

    setCurrentPage("workspace");
    // Fire-and-forget — don't block navigation
    runWorkbookDetection();
  }

  // ── branch actions ────────────────────────────────────────────────────────────

  async function onNewScenario(name: string) {
    if (!runSession.runId || !runSession.branchId) {
      setError("Select a run and branch before creating a scenario.");
      return;
    }
    const client = getApiClient(normalizedApiUrl);

    // 1. Auto-snapshot current workbook state onto the current branch
    let snapshotStepId: string | null = runSession.lastStepId;
    try {
      const fileName = `scenario-snapshot-${Date.now()}.xlsx`;
      const { blob, sizeBytes } = await getWorkbookBlob();
      const upload = await client.storage.getUploadUrl.mutate({
        snapshotId,
        fileName,
        contentType: WORKBOOK_CONTENT_TYPE,
        sizeBytes,
      });
      await fetch(upload.uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": WORKBOOK_CONTENT_TYPE },
      });
      const completed = await client.storage.completeUpload.mutate({
        snapshotId,
        bucket: upload.bucket,
        objectKey: upload.objectKey,
        fileName,
        contentType: WORKBOOK_CONTENT_TYPE,
        sizeBytes,
        documentType: "workbook_tool",
      });
      const stepId = await appendRunStepIfActive({
        client,
        runSession,
        stepType: "scenario_snapshot",
        documentId: completed.documentId,
        idempotencyKey: `scenario-snapshot:${runSession.branchId}:${Date.now()}`,
        parametersJson: { scenarioName: name, snapshotAt: new Date().toISOString() },
      });
      if (stepId) snapshotStepId = stepId;
    } catch {
      // proceed without snapshot — fork still happens
    }

    // 2. Fork from that snapshot point into a named scenario branch
    try {
      const created = await client.operations.createBranch.mutate({
        runId: runSession.runId,
        name,
        parentBranchId: runSession.branchId,
        forkedFromStepId: snapshotStepId ?? undefined,
      });
      const forkStepId = await appendRunStepIfActive({
        client,
        runSession: { ...runSession, branchId: created.branchId },
        runId: runSession.runId,
        branchId: created.branchId,
        stepType: "branch_forked",
        idempotencyKey: `branch-forked:${created.branchId}`,
        parametersJson: {
          parentBranchId: runSession.branchId,
          newBranchId: created.branchId,
          branchName: name,
          forkedFromStepId: snapshotStepId ?? null,
        },
      });
      const branchesResult = await client.operations.getRunBranches.query({
        runId: runSession.runId,
      });
      setAvailableBranches(toBranchOptions(branchesResult.branches));
      setSelectedBranchId(created.branchId);
      mergeRunSession({
        branchId: created.branchId,
        lastStepId: forkStepId ?? null,
        startedAtIso: new Date().toISOString(),
      });
      await onLoadCommittedOperations(runSession.runId, created.branchId);
      setOk(`Created scenario "${name}".`);
    } catch (error) {
      setError(`Create scenario failed: ${formatError(error)}`);
    }
  }

  async function onSaveScenario() {
    if (!runSession.runId || !runSession.branchId) return;
    const client = getApiClient(normalizedApiUrl);
    const savedAt = new Date().toISOString();

    // 1. Upload workbook snapshot
    let documentId: string | undefined;
    try {
      const fileName = `scenario-save-${Date.now()}.xlsx`;
      const { blob, sizeBytes } = await getWorkbookBlob();
      const upload = await client.storage.getUploadUrl.mutate({
        snapshotId,
        fileName,
        contentType: WORKBOOK_CONTENT_TYPE,
        sizeBytes,
      });
      await fetch(upload.uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": WORKBOOK_CONTENT_TYPE },
      });
      const completed = await client.storage.completeUpload.mutate({
        snapshotId,
        bucket: upload.bucket,
        objectKey: upload.objectKey,
        fileName,
        contentType: WORKBOOK_CONTENT_TYPE,
        sizeBytes,
        documentType: "workbook_tool",
      });
      documentId = completed.documentId;
    } catch {
      // proceed without snapshot
    }

    // 2. Append snapshot step
    try {
      const stepId = await appendRunStepIfActive({
        client,
        runSession,
        stepType: "scenario_snapshot",
        documentId,
        idempotencyKey: `scenario-save:${runSession.branchId}:${Date.now()}`,
        parametersJson: { savedAt },
      });
      if (stepId) mergeRunSession({ lastStepId: stepId });
    } catch {
      // snapshot step optional
    }

    // 3. Extract assumptions in background and append as a step
    try {
      const sheets = await captureAllSheetSlices();
      if (sheets.length > 0) {
        const result = await client.excel.extractScenarioAssumptions.mutate({
          snapshotId: snapshotId.trim(),
          sheets,
        });
        if (result.assumptions.length > 0) {
          const stepId = await appendRunStepIfActive({
            client,
            runSession,
            stepType: "assumptions_extracted",
            idempotencyKey: `assumptions:${runSession.branchId}:${Date.now()}`,
            parametersJson: {
              assumptions: result.assumptions,
              extractedAt: new Date().toISOString(),
            },
          });
          if (stepId) mergeRunSession({ lastStepId: stepId });
        }
      }
    } catch {
      // assumption extraction is best-effort
    }

    await onLoadCommittedOperations();
    setOk("Scenario saved.");
  }

  // ── committed operations ──────────────────────────────────────────────────────

  async function onLoadCommittedOperations(runIdOverride?: string, branchIdOverride?: string) {
    const runId = runIdOverride ?? runSession.runId;
    const branchId = branchIdOverride ?? runSession.branchId;
    if (!runId || !branchId) return;
    try {
      const client = getApiClient(normalizedApiUrl);
      const result = await client.operations.getBranchEffectiveHistory.query({ runId, branchId });
      setCommittedOperations(
        result.steps.map(
          (s: {
            id: string;
            stepIndex: number;
            stepType: string;
            parametersJson: unknown;
            branchId: string;
            documentId: string | null;
          }) => ({
            id: s.id,
            stepIndex: s.stepIndex,
            stepType: s.stepType,
            parametersJson: s.parametersJson,
            branchId: s.branchId,
            documentId: s.documentId,
          }),
        ),
      );
    } catch {
      setCommittedOperations([]);
    }
  }

  async function resolveDownloadUrl(documentId: string): Promise<string> {
    const cached = getCachedDownloadUrl(documentId);
    if (cached) return cached;
    const client = getApiClient(normalizedApiUrl);
    const { downloadUrl } = await client.storage.getDownloadUrlByDocument.query({ documentId });
    setCachedDownloadUrl(documentId, downloadUrl);
    return downloadUrl;
  }

  async function onOpenWorkbook(documentId: string) {
    try {
      Office.context.ui.openBrowserWindow(await resolveDownloadUrl(documentId));
    } catch (error) {
      setError(`Failed to open workbook: ${formatError(error)}`);
    }
  }

  async function onOpenDocument(documentId: string, _fileExtension: string | null) {
    try {
      Office.context.ui.openBrowserWindow(await resolveDownloadUrl(documentId));
    } catch (error) {
      setError(`Failed to open document: ${formatError(error)}`);
    }
  }

  // ── workbook region detection ─────────────────────────────────────────────────

  async function runWorkbookDetection() {
    if (!snapshotId.trim()) return;
    try {
      const sheets = await captureAllSheetSlices();
      if (sheets.length === 0) return;
      const client = getApiClient(normalizedApiUrl);
      const result = await client.excel.detectWorkbookRegions.mutate({ snapshotId: snapshotId.trim(), sheets });
      console.log("[detect] result:", JSON.stringify(result, null, 2));
      type RegionItem = { address: string; reason: string; confidencePercent: number };
      type SheetResult = { sheetName: string; inputRegions: RegionItem[]; outputRegions: RegionItem[] };
      const allRegions = result.sheets.flatMap((s: SheetResult) => [
        ...s.inputRegions.map((r) => ({
          address: r.address,
          regionType: "input" as const,
          confidencePercent: r.confidencePercent,
          userConfirmed: false,
          sheetName: s.sheetName,
          reason: r.reason,
        })),
        ...s.outputRegions.map((r) => ({
          address: r.address,
          regionType: "output" as const,
          confidencePercent: r.confidencePercent,
          userConfirmed: false,
          sheetName: s.sheetName,
          reason: r.reason,
        })),
      ]);
      setDetectedRegions(allRegions);
      if (result.promptMessage) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: result.promptMessage! },
        ]);
      }
    } catch {
      // silent — best-effort
    }
  }

  // ── chat ──────────────────────────────────────────────────────────────────────

  async function onAsk(
    text: string,
    context: {
      runId: string;
      branchId: string | null;
      selectedRange: string | null;
      history: Array<{ role: "user" | "assistant"; text: string }>;
    },
  ): Promise<{ reply: string; excelAction?: { type: "write_range"; startCell: string; values: unknown[][]; sheetName?: string; description: string } | null }> {
    const client = getApiClient(normalizedApiUrl);
    const result = await client.chat.sendMessage.mutate({
      snapshotId: snapshotId.trim(),
      runId: context.runId || null,
      branchId: context.branchId,
      messages: [
        ...context.history,
        { role: "user", text },
      ],
      selectedRange: context.selectedRange,
    });
    return { reply: result.reply, excelAction: result.excelAction };
  }

  async function onUploadDocument(file: File) {
    if (!snapshotId.trim()) {
      throw new Error("Select a snapshot before uploading.");
    }
    if (file.size <= 0) {
      throw new Error("File is empty.");
    }

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");
    const isXlsx = lowerName.endsWith(".xlsx");
    if (!isCsv && !isXlsx) {
      throw new Error("Only .xlsx and .csv files are supported.");
    }

    const contentType = isCsv
      ? "text/csv"
      : WORKBOOK_CONTENT_TYPE;
    const client = getApiClient(normalizedApiUrl);

    setOk(`Uploading "${file.name}"...`);
    const { uploadUrl, bucket, objectKey } = await client.storage.getUploadUrl.mutate({
      snapshotId: snapshotId.trim(),
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    });

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });
    if (!putRes.ok) {
      throw new Error(`Upload failed (${putRes.status}).`);
    }

    const completed = await client.storage.completeUpload.mutate({
      snapshotId: snapshotId.trim(),
      bucket,
      objectKey,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    });

    await client.ingestion.startDocumentIngestion.mutate({
      snapshotId: snapshotId.trim(),
      documentId: completed.documentId,
    });
    setOk(`Uploaded "${file.name}". Ingestion started.`);
  }

  // ── render ────────────────────────────────────────────────────────────────────

  const canContinueToWorkspace =
    Boolean(selectedClientId && snapshotId.trim()) &&
    (runMode === "create" || Boolean(runSession.runId));

  if (currentPage === "auth") {
    return (
      <AuthPage
        apiUrl={apiUrl}
        email={email}
        password={password}
        authSummary={authSummary}
        status={status}
        loggingIn={isBusy}
        canLogout={authenticated}
        onApiUrlChange={setApiUrl}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onLogin={onLogin}
        onLogout={onLogout}
        onTestConnection={onTestConnection}
      />
    );
  }

  if (currentPage === "run") {
    return (
      <RunSetupPage
        snapshotId={snapshotId}
        selectedClientId={selectedClientId}
        runMode={runMode}
        runSummary={runSummary}
        availableClients={availableClients}
        availableSnapshots={availableSnapshots}
        availableRuns={availableRuns}
        selectedRunId={selectedRunId}
        selectedBranchName={availableBranches.find((b) => b.id === selectedBranchId)?.name ?? null}
        status={status}
        canContinue={canContinueToWorkspace}
        onReloadContext={loadClientAndSnapshotOptions}
        onClientSelect={onSelectClient}
        onSnapshotIdChange={(value) => {
          setSnapshotId(value);
          setAvailableRuns([]);
          setAvailableBranches([]);
          setSelectedRunId("");
          setSelectedBranchId("");
          mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
        }}
        onRunModeChange={(value) => {
          setRunMode(value);
          if (value === "create") {
            setSelectedRunId("");
            setSelectedBranchId("");
            mergeRunSession({ runId: null, branchId: null, lastStepId: null, startedAtIso: null });
          }
        }}
        onLoadRuns={onLoadRuns}
        onRunSelect={onSelectRun}
        onContinue={onContinueFromRunSetup}
      />
    );
  }

  return (
    <WorkspacePage
      runSession={runSession}
      availableBranches={availableBranches}
      committedOperations={committedOperations}
      status={status}
      canFork={Boolean(runSession.runId && runSession.branchId)}
      onBackToRun={() => setCurrentPage("run")}
      onSelectBranch={onSelectBranchFromWorkspace}
      onDeleteBranch={onDeleteBranch}
      onNewScenario={onNewScenario}
      onSaveScenario={onSaveScenario}
      sourceDocuments={sourceDocuments}
      detectedRegions={detectedRegions}
      onDetectRegions={runWorkbookDetection}
      onSelectRegion={selectRange}
      onOpenWorkbook={onOpenWorkbook}
      onOpenDocument={onOpenDocument}
      onUploadDocument={onUploadDocument}
      onAsk={onAsk}
    />
  );
}

// ── utils ─────────────────────────────────────────────────────────────────────

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
