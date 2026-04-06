import { useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { AuthPage } from "@/pages-react/AuthPage";
import { RunSetupPage } from "@/pages-react/RunSetupPage";
import { WorkspacePage } from "@/pages-react/workspace";
import { getApiClient, normalizeApiUrl, testApiConnection } from "@/lib/api/client";
import {
  appendOperationIfActive,
  toRunOptions,
} from "@/features/operations/actions";
import {
  apiUrlAtom,
  webUrlAtom,
  authenticatedAtom,
  authEmailAtom,
  authFullNameAtom,
  authSummaryAtom,
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
  selectedClientIdAtom,
  selectedRunIdAtom,
  snapshotIdAtom,
  statusAtom,
} from "@/features/session/atoms";
import { getWorkbookBlob, captureAllSheetSlices, readAllRegionValues, getWorkbookName, selectRange, WORKBOOK_CONTENT_TYPE } from "@/lib/office/worksheet";
import type { RunSession } from "@/features/types";
import type { SaveContext } from "@/pages-react/workspace/types";

export default function App() {
  // ── persisted atoms ──────────────────────────────────────────────────────────
  const [apiUrl, setApiUrl] = useAtom(apiUrlAtom);
  const [selectedClientId, setSelectedClientId] = useAtom(selectedClientIdAtom);
  const [snapshotId, setSnapshotId] = useAtom(snapshotIdAtom);
  const [runMode, setRunMode] = useAtom(runModeAtom);
  const [selectedRunId, setSelectedRunId] = useAtom(selectedRunIdAtom);
  const [runSession, setRunSession] = useAtom(runSessionAtom);

  // ── ephemeral atoms ──────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  const [, setOfficeReady] = useAtom(officeReadyAtom);
  const [webUrl] = useAtom(webUrlAtom);
  const [authenticated, setAuthenticated] = useAtom(authenticatedAtom);
  const [, setAuthEmail] = useAtom(authEmailAtom);
  const [authFullName, setAuthFullName] = useAtom(authFullNameAtom);
  const [status, setStatus] = useAtom(statusAtom);
  const [isBusy, setIsBusy] = useAtom(isBusyAtom);
  const [availableClients, setAvailableClients] = useAtom(availableClientsAtom);
  const [, setAllSnapshots] = useAtom(allSnapshotsAtom);
  const [availableRuns, setAvailableRuns] = useAtom(availableRunsAtom);
  const [committedOperations, setCommittedOperations] = useAtom(committedOperationsAtom);
  const [sourceDocuments, setSourceDocuments] = useAtom(sourceDocumentsAtom);
  const [detectedRegions, setDetectedRegions] = useAtom(detectedRegionsAtom);
  const [, setChatMessages] = useAtom(chatMessagesAtom);

  // ── derived atoms ────────────────────────────────────────────────────────────
  const availableSnapshots = useAtomValue(availableSnapshotsAtom);
  const authSummary = useAtomValue(authSummaryAtom);
  const runSummary = useAtomValue(runSummaryAtom);

  // ── local ui-only state ───────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isDetectingRegions, setIsDetectingRegions] = useState(false);

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
      const me = await client.auth.me.query();
      setAuthenticated(true);
      setAuthEmail(email.trim());
      setAuthFullName((me as { fullName?: string } | null)?.fullName ?? null);
      await loadClientAndSnapshotOptions();
      // restore persisted run selection — silently clear stale IDs (e.g. after DB wipe)
      if (snapshotId) {
        try {
          await fetchRuns(snapshotId);
          if (selectedRunId) {
            await onLoadCommittedOperations(selectedRunId);
          }
        } catch {
          setSelectedRunId("");
          setAvailableRuns([]);
          setCommittedOperations([]);
          setRunSession({ runId: null, currentOperationId: null, startedAtIso: null });
        }
      }
      setCurrentPage("run");
      setOk("Authenticated with Pactolus API.");
    } catch (error) {
      setAuthenticated(false);
      setAuthEmail(null);
      setAuthFullName(null);
      setError(`Login failed: ${formatError(error)}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function onLogout() {
    setAuthenticated(false);
    setAuthEmail(null);
    setRunSession({ runId: null, currentOperationId: null, startedAtIso: null });
    setAvailableRuns([]);
    setAvailableClients([]);
    setAllSnapshots([]);
    setSelectedClientId("");
    setSnapshotId("");
    setSelectedRunId("");
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
      setSelectedRunId("");
      setCommittedOperations([]);
      setRunSession({ runId: null, currentOperationId: null, startedAtIso: null });
      setOk(`Loaded ${runs.length} run(s). Select a run to continue.`);
    } catch (error) {
      setError(`Load runs failed: ${formatError(error)}`);
    }
  }

  function onSelectClient(clientId: string) {
    setSelectedClientId(clientId);
    setSnapshotId("");
    setAvailableRuns([]);
    setSelectedRunId("");
    setCommittedOperations([]);
    setRunSession({ runId: null, currentOperationId: null, startedAtIso: null });
  }

  async function onSelectRun(runId: string) {
    setSelectedRunId(runId);
    if (!runId) {
      setCommittedOperations([]);
      setRunSession({ runId: null, currentOperationId: null, startedAtIso: null });
      return;
    }
    setRunMode("select");
    // Load existing operations so user can see the tree before entering workspace
    try {
      await onLoadCommittedOperations(runId);
      // Set the run in session — currentOperationId will be resolved from the loaded operations
      const client = getApiClient(normalizedApiUrl);
      const result = await client.operations.getRunOperations.query({ runId });
      const supersededIds = new Set(result.operations.map((o: { supersedesOperationId: string | null }) => o.supersedesOperationId).filter(Boolean));
      const tip = result.operations
        .filter((o: { operationType: string; id: string }) => o.operationType === "scenario_snapshot" && !supersededIds.has(o.id))
        .at(-1);
      mergeRunSession({ runId, currentOperationId: tip?.id ?? null, startedAtIso: null });
    } catch (error) {
      setError(`Load run failed: ${formatError(error)}`);
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
        setCommittedOperations([]);
        setRunSession({ runId: runResult.runId, currentOperationId: null, startedAtIso: new Date().toISOString() });
        setOk("Run created. Continue in workspace.");
      } catch (error) {
        setError(`Create run failed: ${formatError(error)}`);
        return;
      }
    } else if (!runSession.runId) {
      setError("Select an existing run before continuing.");
      return;
    } else {
      await onLoadCommittedOperations(runSession.runId);
    }

    // Load source documents
    try {
      const docs = await client.storage.getSourceDocuments.query({ snapshotId: snapshotId.trim() });
      setSourceDocuments(docs.documents);
    } catch {
      setSourceDocuments([]);
    }

    setCurrentPage("workspace");
    runWorkbookDetection();
  }

  // ── save scenario ─────────────────────────────────────────────────────────────

  async function onSaveScenario(narrative: string, context: SaveContext) {
    if (!runSession.runId) return;
    const client = getApiClient(normalizedApiUrl);
    const savedAt = new Date().toISOString();

    // Resolve parentOperationId and supersedesOperationId from SaveContext
    let parentOperationId: string | undefined;
    let supersedesOperationId: string | undefined;

    if (context.kind === "seq") {
      parentOperationId = context.parentStepId ?? undefined;
    } else if (context.kind === "par") {
      parentOperationId = context.parentStepId ?? undefined;
    } else if (context.kind === "update") {
      // supersede the target operation; keep same parent
      const target = committedOperations.find((o) => o.id === context.stepId);
      parentOperationId = target?.parentOperationId ?? undefined;
      supersedesOperationId = context.stepId;
    }

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

    // 2. Append the operation
    const workbookName = await getWorkbookName().catch(() => null);
    let newOperationId: string | null = null;
    try {
      newOperationId = await appendOperationIfActive({
        client,
        runSession,
        operationType: "scenario_snapshot",
        documentId,
        parentOperationId,
        supersedesOperationId,
        parametersJson: {
          savedAt,
          narrative: narrative.trim() || null,
          label: narrative.trim().slice(0, 60) || "Saved",
          workbookName,
          authorName: authFullName ?? null,
        },
      });
      if (newOperationId) {
        mergeRunSession({ currentOperationId: newOperationId });
      }
    } catch {
      // snapshot optional
    }

    // 3. Write captures
    if (newOperationId && runSession.runId) {
      const runIdForCapture = runSession.runId;
      if (narrative.trim()) {
        try {
          await client.operations.saveOperationCapture.mutate({
            runId: runIdForCapture,
            runOperationId: newOperationId,
            captureType: "narrative",
            payloadJson: { text: narrative.trim() },
            summaryText: narrative.trim().slice(0, 500),
          });
        } catch {
          // best-effort
        }
      }
      try {
        // Re-detect regions at save time so values reflect the current workbook state
        const freshRegions = await runWorkbookDetection();
        const regionValues = await readAllRegionValues(freshRegions);
        if (regionValues.length > 0) {
          await client.operations.saveOperationCapture.mutate({
            runId: runIdForCapture,
            runOperationId: newOperationId,
            captureType: "region_values",
            payloadJson: { regions: regionValues },
            summaryText: `${regionValues.filter((r) => r.regionType === "input").length} input, ${regionValues.filter((r) => r.regionType === "output").length} output region(s)`,
          });
        }
      } catch {
        // best-effort
      }

      // 4. Generate AI label asynchronously — reload tree when done
      const finalizeRunId = runIdForCapture;
      const finalizeOpId = newOperationId;
      client.operations.generateOperationLabel
        .mutate({ runId: finalizeRunId, operationId: finalizeOpId })
        .then(() => onLoadCommittedOperations())
        .catch(() => {/* label stays as narrative fallback */});
    }

    await onLoadCommittedOperations();
    setOk("Scenario saved.");
  }

  // ── committed operations ──────────────────────────────────────────────────────

  async function onLoadCommittedOperations(runIdOverride?: string) {
    const runId = runIdOverride ?? runSession.runId;
    if (!runId) return;
    try {
      const client = getApiClient(normalizedApiUrl);
      const result = await client.operations.getRunOperations.query({ runId });
      setCommittedOperations(
        result.operations.map(
          (o: {
            id: string;
            operationIndex: number;
            operationType: string;
            parametersJson: unknown;
            parentOperationId: string | null;
            supersedesOperationId: string | null;
            documentId: string | null;
            createdAt?: Date | string | null;
          }) => ({
            id: o.id,
            operationIndex: o.operationIndex,
            operationType: o.operationType,
            parametersJson: o.parametersJson,
            parentOperationId: o.parentOperationId,
            supersedesOperationId: o.supersedesOperationId,
            documentId: o.documentId,
            createdAt: o.createdAt ? new Date(o.createdAt) : null,
            authorName: (o.parametersJson as Record<string, unknown> | null)?.authorName as string | null ?? null,
          }),
        ),
      );
    } catch {
      setCommittedOperations([]);
    }
  }

  // ── workbook region detection ─────────────────────────────────────────────────

  async function runWorkbookDetection(): Promise<typeof detectedRegions> {
    if (!snapshotId.trim()) return detectedRegions;
    setIsDetectingRegions(true);
    try {
      const sheets = await captureAllSheetSlices();
      if (sheets.length === 0) return detectedRegions;
      const client = getApiClient(normalizedApiUrl);
      const result = await client.excel.detectWorkbookRegions.mutate({ snapshotId: snapshotId.trim(), sheets });
      type RegionItem = { address: string; description: string; reason: string; confidencePercent: number; colHeaderAddress?: string; rowHeaderAddress?: string };
      type SheetResult = { sheetName: string; inputRegions: RegionItem[]; outputRegions: RegionItem[] };
      const allRegions = result.sheets.flatMap((s: SheetResult) => [
        ...s.inputRegions.map((r) => ({
          address: r.address,
          regionType: "input" as const,
          confidencePercent: r.confidencePercent,
          userConfirmed: false,
          sheetName: s.sheetName,
          description: r.description,
          reason: r.reason,
          colHeaderAddress: r.colHeaderAddress,
          rowHeaderAddress: r.rowHeaderAddress,
        })),
        ...s.outputRegions.map((r) => ({
          address: r.address,
          regionType: "output" as const,
          confidencePercent: r.confidencePercent,
          userConfirmed: false,
          sheetName: s.sheetName,
          description: r.description,
          reason: r.reason,
          colHeaderAddress: r.colHeaderAddress,
          rowHeaderAddress: r.rowHeaderAddress,
        })),
      ]);
      setDetectedRegions(allRegions);
      if (result.promptMessage) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: result.promptMessage! },
        ]);
      }
      return allRegions;
    } catch {
      return detectedRegions;
    } finally {
      setIsDetectingRegions(false);
    }
  }

  // ── chat ──────────────────────────────────────────────────────────────────────

  async function onAsk(
    text: string,
    context: {
      runId: string;
      selectedRange: string | null;
      history: Array<{ role: "user" | "assistant"; text: string }>;
    },
  ): Promise<{ reply: string; excelAction?: { type: "write_range"; startCell: string; values: unknown[][]; sheetName?: string; description: string } | null }> {
    const client = getApiClient(normalizedApiUrl);
    const result = await client.chat.sendMessage.mutate({
      snapshotId: snapshotId.trim(),
      runId: context.runId || null,
      branchId: null,
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

    const contentType = isCsv ? "text/csv" : WORKBOOK_CONTENT_TYPE;
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
        status={status}
        canContinue={canContinueToWorkspace}
        onReloadContext={loadClientAndSnapshotOptions}
        onClientSelect={onSelectClient}
        onSnapshotIdChange={(value) => {
          setSnapshotId(value);
          setAvailableRuns([]);
          setSelectedRunId("");
          setCommittedOperations([]);
          setRunSession({ runId: null, currentOperationId: null, startedAtIso: null });
        }}
        onRunModeChange={(value) => {
          setRunMode(value);
          if (value === "create") {
            setSelectedRunId("");
            setCommittedOperations([]);
            setRunSession({ runId: null, currentOperationId: null, startedAtIso: null });
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
      operations={committedOperations}
      status={status}
      clientId={selectedClientId}
      snapshotId={snapshotId}
      webUrl={webUrl}
      onBackToRun={() => setCurrentPage("run")}
      onSaveScenario={onSaveScenario}
      sourceDocuments={sourceDocuments}
      detectedRegions={detectedRegions}
      isDetectingRegions={isDetectingRegions}
      onDetectRegions={() => runWorkbookDetection().then(() => {})}
      onSelectRegion={selectRange}
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
